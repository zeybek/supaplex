//! The rules of Supaplex (SpeedFix 6.3), written from Cillié Malan's MIT
//! disassembly of SPFIX63.EXE. The state is the game's own: a 16-bit word
//! per cell, the tile in the low byte and the progress of a move or blast in
//! the high byte.
//!
//! ```
//! use supaplex_core::{EV_EAT, LEVEL_BYTES, Machine};
//!
//! // A level: hardware (6) everywhere, Murphy (3) beside some base (2).
//! let mut level = [6u8; LEVEL_BYTES];
//! level[61] = 3;
//! level[62] = 2;
//!
//! let mut game = Box::new(Machine::new());
//! game.start(&level, 1);
//! game.frame(4); // one frame with Right held
//! assert_ne!(game.events() & EV_EAT, 0);
//! ```
#![cfg_attr(not(test), no_std)]

mod blast;
mod board;
mod enemies;
mod falling;
mod gadgets;
mod murphy;
mod setup;
mod tiles;

#[cfg(test)]
mod tests;

use board::{Board, SCAN_FIRST, SCAN_LEN, Var};
use tiles::*;

pub const LEVEL_BYTES: usize = 1536;
pub const CELLS: usize = 1440;

// Bits of `Machine::events`.
pub const EV_INFOTRON: u32 = 1;
pub const EV_EXPLOSION: u32 = 2;
pub const EV_PUSH: u32 = 4;
pub const EV_EAT: u32 = 8;
pub const EV_DEATH: u32 = 16;
pub const EV_WIN: u32 = 32;
pub const EV_TERMINAL: u32 = 64;
pub const EV_PORT: u32 = 128;
pub const EV_GRAVITY: u32 = 256;
pub const EV_RED_PICKED: u32 = 512;
pub const EV_RED_DROPPED: u32 = 1024;
pub const EV_EXIT_OPEN: u32 = 2048;
pub const EV_LANDED: u32 = 4096;
pub const EV_BUG_SPARK: u32 = 8192;

// The first value of `Machine::death`.
/// Also walking into a moving Zonk.
pub const DEATH_CRUSHED: u8 = 1;
pub const DEATH_ENEMY: u8 = 2;
/// Also any death not listed here.
pub const DEATH_BLAST: u8 = 3;
pub const DEATH_BUG: u8 = 4;

const LEVEL_GRAVITY: usize = 1444;
const LEVEL_FREEZE_ZONKS: usize = 1469;

/// One game, about 8 KB: keep it in a `Box` or a `static`. A clone is a
/// save state.
#[derive(Clone)]
pub struct Machine {
    board: Board,
    /// Special ports read their settings from here and write back into it.
    level: [u8; LEVEL_BYTES],
    /// Tiles as the frame's object pass began: they pick each cell's routine.
    scan: [u8; SCAN_LEN],

    seed: u16,
    key: u8,

    murphy_at: i32,
    /// Where Murphy last was when he was still on the board.
    murphy_seen_at: i32,
    murphy_on_board: bool,
    /// An explosion reached Murphy's tile this frame or before.
    murphy_caught: bool,
    /// Space alone may set a red disk down only after a frame without keys.
    space_armed: bool,
    /// Frames before a lean or a red disk being set down goes on.
    wait: u16,
    anim_len: u8,
    anim_done: u8,
    facing: u8,

    infotrons_needed: u8,
    /// 0 none; 1 Murphy is setting it down; 2.. burning, blows at 40.
    planted: u8,
    planted_at: i32,
    /// The screen shake draws a random number every frame.
    shaking: bool,
    enemies_frozen: bool,
    ended: bool,

    completed: bool,
    killed: bool,
    death_cause: u8,
    death_cell: i32,
    events: u32,
}

impl Default for Machine {
    fn default() -> Self {
        Self::new()
    }
}

impl Machine {
    pub const fn new() -> Machine {
        Machine {
            board: Board::new(),
            level: [0; LEVEL_BYTES],
            scan: [0; SCAN_LEN],
            seed: 0,
            key: 0,
            murphy_at: 0,
            murphy_seen_at: 0,
            murphy_on_board: false,
            murphy_caught: false,
            space_armed: false,
            wait: 0,
            anim_len: 0,
            anim_done: 0,
            facing: 0,
            infotrons_needed: 0,
            planted: 0,
            planted_at: 0,
            shaking: false,
            enemies_frozen: false,
            ended: false,
            completed: false,
            killed: false,
            death_cause: 0,
            death_cell: 0,
            events: 0,
        }
    }

    /// `seed` decides when bugs spark.
    pub fn start(&mut self, level: &[u8; LEVEL_BYTES], seed: u16) {
        self.load(level, seed);
    }

    /// `key`: 0 none, 1 up, 2 left, 3 down, 4 right, 5 to 8 with Space, 9
    /// Space alone. Does nothing once the level is over.
    pub fn frame(&mut self, key: u8) {
        self.events = 0;
        if self.ended {
            return;
        }
        self.key = key & 0x0f;

        self.update_murphy();
        self.move_objects();
        self.check_murphy_lost();
        self.burn_red_disk();
        self.count_down_blasts();
        if self.shaking {
            self.random();
        }

        if self.board.word_var(Var::Halt) != 0 {
            self.ended = true;
            return;
        }
        self.set_tick(self.tick().wrapping_add(1));
        if self.board.word_var(Var::Leave) == 1 {
            self.ended = true;
            return;
        }
        let quit = self.quit();
        if quit != 0 {
            self.set_quit(quit - 1);
            if quit == 1 {
                self.ended = true;
            }
        }
    }

    /// Every cell but the outer ring gets its object's routine, chosen from
    /// the tiles as they were before any moved.
    fn move_objects(&mut self) {
        for i in 0..SCAN_LEN {
            self.scan[i] = self.board.tile(SCAN_FIRST + i as i32);
        }
        for i in 0..SCAN_LEN {
            let c = SCAN_FIRST + i as i32;
            match self.scan[i] {
                ZONK => self.zonk(c),
                INFOTRON => self.infotron(c),
                ORANGE_DISK => self.orange_disk(c),
                SNIK_SNAK => self.snik_snak(c),
                TERMINAL => self.terminal(c),
                ELECTRON => self.electron(c),
                BUG => self.bug(c),
                EXPLOSION => self.explosion_tick(c),
                _ => {}
            }
        }
    }

    /// Murphy gone from his cell or caught: blow up where he was last seen.
    fn check_murphy_lost(&mut self) {
        let gone = self.murphy_caught || !self.murphy_on_board;
        if !gone || self.quit() != 0 {
            return;
        }
        self.murphy_caught = false;
        if !self.completed && !self.killed {
            self.killed = true;
            self.events |= EV_DEATH;
            if self.death_cause == 0 {
                self.death_cause = DEATH_BLAST;
                self.death_cell = self.murphy_seen_at;
            }
        }
        self.explode(self.murphy_seen_at, DEATH_BLAST);
        self.set_quit(0x40);
    }

    /// A 16-bit linear congruence; callers get the new seed shifted right.
    fn random(&mut self) -> u16 {
        self.seed = self.seed.wrapping_mul(0x5e5).wrapping_add(0x31);
        self.seed >> 1
    }

    // The counters the game keeps in the memory before the level.

    fn tick(&self) -> u16 {
        self.board.word_var(Var::Tick)
    }

    fn set_tick(&mut self, value: u16) {
        self.board.set_word_var(Var::Tick, value);
    }

    fn quit(&self) -> u16 {
        self.board.word_var(Var::Quit)
    }

    fn set_quit(&mut self, value: u16) {
        self.board.set_word_var(Var::Quit, value);
    }

    fn infotrons(&self) -> u8 {
        self.board.byte(Var::InfotronsLeft)
    }

    fn set_infotrons(&mut self, value: u8) {
        self.board.set_byte(Var::InfotronsLeft, value);
    }

    fn disks(&self) -> u8 {
        self.board.byte(Var::RedDisks)
    }

    fn set_disks(&mut self, value: u8) {
        self.board.set_byte(Var::RedDisks, value);
    }

    fn gravity_on(&self) -> bool {
        self.level[LEVEL_GRAVITY] != 0
    }

    fn zonks_are_frozen(&self) -> bool {
        self.level[LEVEL_FREEZE_ZONKS] == 2
    }

    /// The level file code, or a marker for a cell something moves through.
    pub fn tile(&self, cell: i32) -> u8 {
        if (0..CELLS as i32).contains(&cell) {
            self.board.tile(cell)
        } else {
            0
        }
    }

    /// How far a fall, roll, step or explosion has got.
    pub fn state(&self, cell: i32) -> u8 {
        if (0..CELLS as i32).contains(&cell) {
            self.board.state(cell)
        } else {
            0
        }
    }

    /// Countdown to a delayed explosion; negative for one that leaves Infotrons.
    pub fn timer(&self, cell: usize) -> i8 {
        if cell < CELLS {
            self.board.timer(cell as i32)
        } else {
            0
        }
    }

    /// Can be outside `0..CELLS` on a level without walls.
    pub fn murphy(&self) -> i32 {
        self.murphy_at
    }

    pub fn seed(&self) -> u16 {
        self.seed
    }

    pub fn infotrons_left(&self) -> u8 {
        self.infotrons()
    }

    pub fn infotrons_needed(&self) -> u8 {
        self.infotrons_needed
    }

    pub fn red_disks(&self) -> u8 {
        self.disks()
    }

    pub fn gravity(&self) -> bool {
        self.gravity_on()
    }

    pub fn zonks_frozen(&self) -> bool {
        self.zonks_are_frozen()
    }

    pub fn enemies_frozen(&self) -> bool {
        self.enemies_frozen
    }

    pub fn set_gravity(&mut self, on: bool) {
        self.level[LEVEL_GRAVITY] = on as u8;
    }

    pub fn set_enemies_frozen(&mut self, on: bool) {
        self.enemies_frozen = on;
    }

    /// `(countdown, cell)`: 1 while being set down, then 2 up to 40, when it
    /// goes off. `(0, 0)` for none.
    pub fn planted(&self) -> (u8, i32) {
        if self.planted == 0 {
            (0, 0)
        } else {
            (self.planted, self.planted_at)
        }
    }

    /// Frames before a lean becomes a push or a red disk is set down.
    pub fn push_counter(&self) -> u8 {
        let m = self.murphy_at;
        if self.board.tile(m) != MURPHY {
            return 0;
        }
        match self.board.state(m) {
            0x0e | 0x0f | 0x24..=0x2a => self.wait as u8,
            _ => 0,
        }
    }

    /// `(frames done, frames it lasts)`.
    pub fn animation(&self) -> (u8, u8) {
        (self.anim_done, self.anim_len)
    }

    /// The last arrow acted on: 0 up, 1 left, 2 down, 3 right.
    pub fn facing(&self) -> u8 {
        self.facing
    }

    /// From 64 when the level is won or lost; 0 before.
    pub fn quit_countdown(&self) -> u8 {
        self.quit() as u8
    }

    pub fn completed(&self) -> bool {
        self.completed
    }

    /// Never after the level is completed.
    pub fn killed(&self) -> bool {
        self.killed
    }

    /// `(DEATH_*, cell)`; `(0, 0)` while he lives.
    pub fn death(&self) -> (u8, i32) {
        (self.death_cause, self.death_cell)
    }

    /// `EV_*` bits of the last frame.
    pub fn events(&self) -> u32 {
        self.events
    }
}
