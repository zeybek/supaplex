//! Murphy: reading the key when he stands still, starting a move, the
//! frames of a lean or of setting a red disk down, and what each move
//! leaves behind when its animation ends.
//!
//! While a move runs, Murphy's state byte says which move it is; the tile
//! of a cell he is entering is set to Murphy at once and the cell he is
//! leaving keeps tile 0 with state 3 until the move ends.

use crate::board::{Var, W};
use crate::tiles::*;
use crate::*;

/// The four directions as the keys number them.
const UP: u8 = 1;
const LEFT: u8 = 2;
const DOWN: u8 = 3;
const RIGHT: u8 = 4;
const SPACE_ALONE: u8 = 9;

/// Murphy's states (the move in progress).
#[allow(dead_code)]
mod st {
    pub const WALK_UP: u8 = 0x01;
    pub const WALK_LEFT: u8 = 0x02;
    pub const WALK_DOWN: u8 = 0x03;
    pub const WALK_RIGHT: u8 = 0x04;
    pub const BASE_UP: u8 = 0x05;
    pub const BASE_LEFT: u8 = 0x06;
    pub const BASE_DOWN: u8 = 0x07;
    pub const BASE_RIGHT: u8 = 0x08;
    pub const INFOTRON_UP: u8 = 0x09;
    pub const INFOTRON_LEFT: u8 = 0x0a;
    pub const INFOTRON_DOWN: u8 = 0x0b;
    pub const INFOTRON_RIGHT: u8 = 0x0c;
    pub const EXITING: u8 = 0x0d;
    pub const PUSH_ZONK_LEFT: u8 = 0x0e;
    pub const PUSH_ZONK_RIGHT: u8 = 0x0f;
    pub const SNAP_BASE_UP: u8 = 0x10;
    pub const SNAP_BASE_LEFT: u8 = 0x11;
    pub const SNAP_BASE_DOWN: u8 = 0x12;
    pub const SNAP_BASE_RIGHT: u8 = 0x13;
    pub const SNAP_INFOTRON_UP: u8 = 0x14;
    pub const SNAP_INFOTRON_LEFT: u8 = 0x15;
    pub const SNAP_INFOTRON_DOWN: u8 = 0x16;
    pub const SNAP_INFOTRON_RIGHT: u8 = 0x17;
    pub const PORT_UP: u8 = 0x18;
    pub const PORT_LEFT: u8 = 0x19;
    pub const PORT_DOWN: u8 = 0x1a;
    pub const PORT_RIGHT: u8 = 0x1b;
    pub const RED_UP: u8 = 0x1c;
    pub const RED_LEFT: u8 = 0x1d;
    pub const RED_DOWN: u8 = 0x1e;
    pub const RED_RIGHT: u8 = 0x1f;
    pub const SNAP_RED_UP: u8 = 0x20;
    pub const SNAP_RED_LEFT: u8 = 0x21;
    pub const SNAP_RED_DOWN: u8 = 0x22;
    pub const SNAP_RED_RIGHT: u8 = 0x23;
    pub const PUSH_YELLOW_UP: u8 = 0x24;
    pub const PUSH_YELLOW_LEFT: u8 = 0x25;
    pub const PUSH_YELLOW_RIGHT: u8 = 0x26;
    pub const PUSH_YELLOW_DOWN: u8 = 0x27;
    pub const PUSH_ORANGE_LEFT: u8 = 0x28;
    pub const PUSH_ORANGE_RIGHT: u8 = 0x29;
    pub const DROP_RED: u8 = 0x2a;
}

/// Frames a lean lasts before the push animates.
const LEAN_FRAMES: u16 = 8;
/// Frames Space must be held to set a red disk down.
const DROP_FRAMES: u16 = 0x40;

/// How many frames the animation of a move lasts (the length of the
/// game's frame lists for it).
fn animation_frames(state: u8) -> u8 {
    match state {
        st::EXITING => 40,
        st::SNAP_INFOTRON_UP..=st::SNAP_INFOTRON_RIGHT => 7,
        st::RED_RIGHT => 9,
        st::DROP_RED => 1,
        _ => 8,
    }
}

fn step(dir: u8) -> i32 {
    match dir {
        UP => -W,
        LEFT => -1,
        DOWN => W,
        _ => 1,
    }
}

impl Machine {
    pub(crate) fn update_murphy(&mut self) {
        let m = self.murphy_at;
        if self.board.tile(m) != MURPHY {
            self.murphy_on_board = false;
            return;
        }
        self.murphy_on_board = true;
        self.murphy_seen_at = m;
        if self.board.word(m) != at_rest(MURPHY) {
            self.advance_move();
        } else {
            self.read_key(m);
        }
    }

    /// Murphy stands still: act on the key.
    fn read_key(&mut self, m: i32) {
        let falling = self.gravity_on()
            && !matches!(self.board.tile(m - W), PORT_UP | PORT_VERTICAL | PORT_CROSS)
            && self.board.word(m + W) == 0;

        let mut key = self.key;
        if key == 0 {
            self.space_armed = true;
            if falling {
                self.walk(m, DOWN);
            }
            return;
        }
        if falling {
            // Gravity lets him only eat a base above or beside him; any other
            // key makes him fall.
            let base_there = match key {
                UP | LEFT | RIGHT => self.board.word(m + step(key)) == at_rest(BASE),
                _ => false,
            };
            if !base_there {
                key = DOWN;
            }
        }
        if key != SPACE_ALONE {
            self.space_armed = false;
        }
        match key {
            UP..=RIGHT => {
                self.facing = key - 1;
                self.walk(m, key);
            }
            5..=8 => {
                self.facing = key - 5;
                self.snap(m, key - 4);
            }
            SPACE_ALONE => self.start_red_disk_drop(m),
            _ => {}
        }
    }

    /// Start a move with an arrow alone.
    fn walk(&mut self, m: i32, dir: u8) {
        let d = step(dir);
        let to = m + d;
        let horizontal = dir == LEFT || dir == RIGHT;
        loop {
            let word = self.board.word(to);
            let tile = word as u8;
            if word == 0 {
                return self.enter(m, dir, st::WALK_UP + dir - 1);
            }
            if word == at_rest(BASE) {
                return self.eat_base(m, dir);
            }
            if tile == BUG {
                return self.touch_bug(m, to, |me| me.eat_base(m, dir));
            }
            // Going down, the recorded games take an Infotron whatever its
            // state (one still rolling in too); other ways only a resting
            // one.
            let infotron = if dir == DOWN {
                tile == INFOTRON
            } else {
                word == at_rest(INFOTRON)
            };
            if infotron {
                return self.enter(m, dir, st::INFOTRON_UP + dir - 1);
            }
            if word == at_rest(EXIT) {
                return self.reach_exit(m);
            }
            if horizontal && word == at_rest(ZONK) {
                return self.lean_on_zonk(m, dir);
            }
            if tile == TERMINAL {
                return self.use_terminal();
            }
            if self.port_lets_through(tile, dir) {
                return self.enter_port(m, dir);
            }
            // Going left the game compares the whole word, other ways only
            // the tile.
            let red = if dir == LEFT {
                word == at_rest(RED_DISK)
            } else {
                tile == RED_DISK
            };
            if red {
                return self.walk_onto_red_disk(m, dir);
            }
            let yellow = if dir == LEFT {
                word == at_rest(YELLOW_DISK)
            } else {
                tile == YELLOW_DISK
            };
            if yellow {
                return self.lean_on_yellow_disk(m, dir);
            }
            if horizontal && word == at_rest(ORANGE_DISK) {
                return self.lean_on_orange_disk(m, dir);
            }
            if !self.bump(to, dir) {
                return;
            }
        }
    }

    /// Start a move with Space held: act on the next cell without moving.
    fn snap(&mut self, m: i32, dir: u8) {
        let to = m + step(dir);
        let word = self.board.word(to);
        let tile = word as u8;
        if word == at_rest(BASE) {
            self.snap_base(m, dir);
        } else if tile == BUG {
            self.touch_bug(m, to, |me| me.snap_base(m, dir));
        } else if word == at_rest(INFOTRON) {
            self.board.set_state(to, 0xff);
            self.begin(m, st::SNAP_INFOTRON_UP + dir - 1, 0);
        } else if tile == TERMINAL {
            self.use_terminal();
        } else if tile == RED_DISK {
            self.board.set_state(to, 3);
            self.begin(m, st::SNAP_RED_UP + dir - 1, 0);
        }
    }

    /// Murphy steps into the next cell at once: it gets his tile and the
    /// move's state, the cell he leaves keeps state 3.
    fn enter(&mut self, m: i32, dir: u8, state: u8) {
        let to = m + step(dir);
        self.board.set_state(to, state);
        self.board.set_tile(to, MURPHY);
        self.board.set_state(m, 3);
        // Going down onto an Infotron, the recorded games leave a base tile
        // in the cell he leaves; the disassembly does not.
        self.board.set_tile(
            m,
            if state == st::INFOTRON_DOWN {
                BASE
            } else {
                EMPTY
            },
        );
        self.murphy_at = to;
        self.begin(to, state, 0);
    }

    fn eat_base(&mut self, m: i32, dir: u8) {
        self.events |= EV_EAT;
        // Eating a base to the left the game uses the plain walking state.
        let state = if dir == LEFT {
            st::WALK_LEFT
        } else {
            st::BASE_UP + dir - 1
        };
        self.enter(m, dir, state);
    }

    fn snap_base(&mut self, m: i32, dir: u8) {
        self.events |= EV_EAT;
        self.begin(m, st::SNAP_BASE_UP + dir - 1, 0);
    }

    /// A bug sparking kills Murphy; a quiet one is a base.
    fn touch_bug(&mut self, m: i32, bug: i32, as_base: impl FnOnce(&mut Self)) {
        if (self.board.state(bug) as i8) >= 0 {
            self.explode(m, DEATH_BUG);
        } else {
            self.board.set(bug, at_rest(BASE));
            as_base(self);
        }
    }

    fn reach_exit(&mut self, m: i32) {
        if self.infotrons() != 0 {
            return;
        }
        if !self.completed {
            self.completed = true;
            self.events |= EV_WIN;
        }
        self.set_quit(0x40);
        self.begin(m, st::EXITING, 0);
    }

    fn lean_on_zonk(&mut self, m: i32, dir: u8) {
        let d = step(dir);
        if self.board.word(m + 2 * d) != 0 {
            return;
        }
        // Pushing right needs the Zonk to stand on something.
        if dir == RIGHT && self.board.word(m + d + W) == 0 {
            return;
        }
        self.board.set_state(m + 2 * d, 1);
        let state = if dir == LEFT {
            st::PUSH_ZONK_LEFT
        } else {
            st::PUSH_ZONK_RIGHT
        };
        self.events |= EV_PUSH;
        self.begin(m, state, LEAN_FRAMES);
    }

    fn lean_on_yellow_disk(&mut self, m: i32, dir: u8) {
        let d = step(dir);
        if self.board.word(m + 2 * d) != 0 {
            return;
        }
        self.board.set_state(m + 2 * d, YELLOW_DISK);
        let state = match dir {
            UP => st::PUSH_YELLOW_UP,
            LEFT => st::PUSH_YELLOW_LEFT,
            DOWN => st::PUSH_YELLOW_DOWN,
            _ => st::PUSH_YELLOW_RIGHT,
        };
        self.events |= EV_PUSH;
        self.begin(m, state, LEAN_FRAMES);
    }

    fn lean_on_orange_disk(&mut self, m: i32, dir: u8) {
        let d = step(dir);
        if self.board.word(m + 2 * d) != 0 {
            return;
        }
        let state = if dir == LEFT {
            self.board.set_state(m + 2 * d, ORANGE_DISK);
            st::PUSH_ORANGE_LEFT
        } else {
            if self.board.word(m + d + W) == 0 {
                return;
            }
            self.board.set_state(m + 2 * d, 1);
            st::PUSH_ORANGE_RIGHT
        };
        self.events |= EV_PUSH;
        self.begin(m, state, LEAN_FRAMES);
    }

    /// Whether a port tile lets Murphy through going this way.
    fn port_lets_through(&self, tile: u8, dir: u8) -> bool {
        match dir {
            UP => matches!(tile, PORT_UP | PORT_VERTICAL | PORT_CROSS),
            LEFT => matches!(tile, PORT_LEFT | PORT_HORIZONTAL | PORT_CROSS),
            DOWN => matches!(tile, PORT_DOWN | PORT_VERTICAL | PORT_CROSS),
            _ => matches!(tile, PORT_RIGHT | PORT_HORIZONTAL | PORT_CROSS),
        }
    }

    fn enter_port(&mut self, m: i32, dir: u8) {
        let beyond = m + 2 * step(dir);
        if self.board.word(beyond) != 0 {
            return;
        }
        self.board.set_state(beyond, 3);
        self.events |= EV_PORT;
        self.begin(m, st::PORT_UP + dir - 1, 0);
    }

    /// Up and down Murphy stays in his cell until the move ends; left and
    /// right he steps over at once.
    fn walk_onto_red_disk(&mut self, m: i32, dir: u8) {
        match dir {
            UP | DOWN => {
                self.board.set_state(m + step(dir), 3);
                let state = if dir == UP { st::RED_UP } else { st::RED_DOWN };
                self.begin(m, state, 0);
            }
            LEFT => self.enter(m, dir, st::RED_LEFT),
            _ => self.enter(m, dir, st::RED_RIGHT),
        }
    }

    fn start_red_disk_drop(&mut self, m: i32) {
        if self.disks() == 0 || self.planted != 0 || !self.space_armed {
            return;
        }
        self.board.set_state(m, st::DROP_RED);
        self.planted = 1;
        self.planted_at = m;
        self.begin_anim(st::DROP_RED, DROP_FRAMES);
        self.advance_move();
    }

    /// The first terminal used sets off every yellow disk, in cell order.
    fn use_terminal(&mut self) {
        if self.board.byte(Var::TerminalUsed) != 0 {
            return;
        }
        self.board.set_byte(Var::TerminalMask, 7);
        self.board.set_byte(Var::TerminalUsed, 1);
        self.events |= EV_TERMINAL;
        for c in 0..CELLS as i32 {
            if self.board.word(c) == at_rest(YELLOW_DISK) {
                self.explode(c, DEATH_BLAST);
            }
        }
    }

    /// Murphy runs into something he cannot enter. Returns true when the
    /// cell was cleared and the move may be tried again.
    fn bump(&mut self, c: i32, dir: u8) -> bool {
        let word = self.board.word(c);
        let tile = word as u8;
        let state = (word >> 8) as u8;
        if word == LEAVING || word == ROLLED_FROM || state == 0 {
            return false;
        }
        match tile {
            ZONK => {
                // A Zonk moving across his path kills him unless it is already
                // on its way out of it.
                let harmless: &[u8] = match dir {
                    LEFT => &[0x20, 0x40, 0x50, 0x70],
                    RIGHT => &[0x30, 0x40, 0x60, 0x70],
                    _ => &[],
                };
                if !harmless.contains(&(state & 0xf0)) {
                    self.explode(c, DEATH_CRUSHED);
                }
                false
            }
            EXPLOSION => {
                // A blast that is dying down may be walked into.
                if (state as i8) < 4 {
                    self.explode(c, DEATH_BLAST);
                    false
                } else {
                    self.board.set(c, 0);
                    true
                }
            }
            ORANGE_DISK..=PORT_UP => false,
            SNIK_SNAK | ELECTRON | TRAIL => {
                self.explode(c, DEATH_ENEMY);
                false
            }
            _ => {
                self.explode(c, DEATH_BLAST);
                false
            }
        }
    }

    /// Set up a move's animation and run its first frame.
    fn begin(&mut self, m: i32, state: u8, wait: u16) {
        self.board.set_state(m, state);
        self.begin_anim(state, wait);
        self.advance_move();
    }

    fn begin_anim(&mut self, state: u8, wait: u16) {
        self.wait = wait;
        self.anim_len = animation_frames(state);
        self.anim_done = 0;
    }

    /// One frame of the move in progress.
    fn advance_move(&mut self) {
        let m = self.murphy_at;
        if self.wait > 0 {
            self.wait -= 1;
            self.hold(m);
            return;
        }
        self.anim_done = self.anim_done.wrapping_add(1);
        if self.anim_done >= self.anim_len {
            self.finish_move(m);
        }
    }

    /// A frame of leaning or of setting a red disk down: the key must stay
    /// on and the thing pushed must stay put, or Murphy gives up.
    fn hold(&mut self, m: i32) {
        let key = self.key;
        let (dir, thing) = match self.board.state(m) {
            st::PUSH_ZONK_LEFT => (LEFT, ZONK),
            st::PUSH_ZONK_RIGHT => (RIGHT, ZONK),
            st::PUSH_ORANGE_LEFT => (LEFT, ORANGE_DISK),
            st::PUSH_ORANGE_RIGHT => (RIGHT, ORANGE_DISK),
            st::PUSH_YELLOW_UP => (UP, YELLOW_DISK),
            st::PUSH_YELLOW_LEFT => (LEFT, YELLOW_DISK),
            st::PUSH_YELLOW_DOWN => (DOWN, YELLOW_DISK),
            st::PUSH_YELLOW_RIGHT => (RIGHT, YELLOW_DISK),
            st::DROP_RED => {
                if key == SPACE_ALONE {
                    if self.wait <= 0x20 {
                        self.planted = 1;
                    }
                } else {
                    self.board.set(m, at_rest(MURPHY));
                    self.planted = 0;
                }
                return;
            }
            _ => return,
        };
        let d = step(dir);
        if key == dir && self.board.word(m + d) == at_rest(thing) {
            return;
        }
        self.board.set(m, at_rest(MURPHY));
        self.board.set(m + d, at_rest(thing));
        self.clear_unless_blast(m + 2 * d);
    }

    /// The last frame of a move's animation: settle the cells.
    fn finish_move(&mut self, m: i32) {
        let state = self.board.state(m);
        self.board.set_state(m, 0);
        match state {
            st::WALK_UP..=st::BASE_RIGHT => self.settle_walk(m, (state - 1) % 4 + 1),
            st::INFOTRON_UP..=st::INFOTRON_RIGHT => {
                self.collect_infotron();
                self.settle_walk(m, state - st::INFOTRON_UP + 1);
            }
            st::EXITING => self.board.set_word_var(Var::Leave, 1),
            st::PUSH_ZONK_LEFT | st::PUSH_ZONK_RIGHT => {
                let d = if state == st::PUSH_ZONK_LEFT { -1 } else { 1 };
                if self.board.tile(m) != EXPLOSION {
                    self.board.set(m, 0);
                }
                self.board.set(m + d, at_rest(MURPHY));
                self.board.set(m + 2 * d, at_rest(ZONK));
                self.zonk_lands_on_enemy(m + 2 * d);
                self.murphy_at = m + d;
            }
            st::SNAP_BASE_UP..=st::SNAP_BASE_RIGHT => {
                let dir = state - st::SNAP_BASE_UP + 1;
                self.clear_unless_blast(m + step(dir));
            }
            st::SNAP_INFOTRON_UP..=st::SNAP_INFOTRON_RIGHT => {
                self.collect_infotron();
                let dir = state - st::SNAP_INFOTRON_UP + 1;
                self.clear_unless_blast(m + step(dir));
            }
            st::PORT_UP..=st::PORT_RIGHT => {
                let d = step(state - st::PORT_UP + 1);
                self.clear_unless_blast(m);
                self.board.set(m + 2 * d, at_rest(MURPHY));
                self.murphy_at = m + 2 * d;
                if self.board.state(m + d) == 1 {
                    self.special_port(m + d);
                }
            }
            st::RED_UP | st::RED_DOWN => {
                let d = if state == st::RED_UP { -W } else { W };
                self.clear_unless_blast(m);
                self.board.set(m + d, at_rest(MURPHY));
                self.murphy_at = m + d;
                self.pick_red_disk(m + d);
            }
            st::RED_LEFT | st::RED_RIGHT => {
                let from = if state == st::RED_LEFT { m + 1 } else { m - 1 };
                self.clear_unless_blast(from);
                self.board.set(m, at_rest(MURPHY));
                self.pick_red_disk(m);
            }
            st::SNAP_RED_UP..=st::SNAP_RED_RIGHT => {
                let disk = m + step(state - st::SNAP_RED_UP + 1);
                self.clear_unless_blast(disk);
                self.pick_red_disk(disk);
            }
            st::PUSH_YELLOW_UP..=st::PUSH_YELLOW_DOWN => {
                let dir = match state {
                    st::PUSH_YELLOW_UP => UP,
                    st::PUSH_YELLOW_LEFT => LEFT,
                    st::PUSH_YELLOW_RIGHT => RIGHT,
                    _ => DOWN,
                };
                let d = step(dir);
                self.clear_unless_blast(m);
                self.board.set(m + d, at_rest(MURPHY));
                self.board.set(m + 2 * d, at_rest(YELLOW_DISK));
                self.murphy_at = m + d;
            }
            st::PUSH_ORANGE_LEFT => {
                self.clear_unless_blast(m);
                self.board.set(m - 1, at_rest(MURPHY));
                self.board.set(m - 2, at_rest(ORANGE_DISK));
                self.murphy_at = m - 1;
            }
            st::PUSH_ORANGE_RIGHT => {
                self.clear_unless_blast(m);
                self.board.set(m + 1, at_rest(MURPHY));
                self.board.set(m + 2, at_rest(ORANGE_DISK));
                // Pushed over a hole, it starts falling at once.
                if self.board.word(m + 2 + W) == 0 {
                    self.board.set_state(m + 2, 0x20);
                    self.board.set_state(m + 2 + W, ORANGE_DISK);
                }
                self.murphy_at = m + 1;
            }
            st::DROP_RED => {
                self.board.set(m, at_rest(MURPHY));
                self.planted = 2;
                self.set_disks(self.disks().wrapping_sub(1));
                self.events |= EV_RED_DROPPED;
            }
            _ => self.board.set_word_var(Var::Leave, 1),
        }
    }

    /// The end of a step: Murphy settles in his new cell and the cell he
    /// came from is emptied (which may set things above it moving).
    fn settle_walk(&mut self, m: i32, dir: u8) {
        match dir {
            UP | LEFT => {
                self.board.set(m, at_rest(MURPHY));
                self.murphy_left(m - step(dir));
            }
            DOWN => {
                self.clear_unless_blast(m - W);
                self.board.set(m, at_rest(MURPHY));
            }
            _ => {
                self.murphy_left(m - 1);
                self.board.set(m, at_rest(MURPHY));
            }
        }
    }

    fn collect_infotron(&mut self) {
        self.events |= EV_INFOTRON;
        let left = self.infotrons();
        if left > 0 {
            self.set_infotrons(left - 1);
            if left == 1 {
                self.events |= EV_EXIT_OPEN;
            }
        }
    }

    /// Picking up a red disk, unless it is the one Murphy has just set down.
    fn pick_red_disk(&mut self, c: i32) {
        if self.planted != 0 && self.planted_at == c {
            return;
        }
        self.set_disks(self.disks().wrapping_add(1));
        self.events |= EV_RED_PICKED;
    }

    /// Murphy has gone through a special port: look it up in the level's
    /// list and take its gravity and freeze settings.
    fn special_port(&mut self, port: i32) {
        let count = self.level[1471] as usize;
        let at = (2 * port) as u16;
        for k in 0..count {
            let o = 1472 + 6 * k;
            let byte = |i: usize| self.level.get(o + i).copied().unwrap_or(0);
            if (byte(0) as u16) << 8 | byte(1) as u16 == at {
                let (gravity, zonks, enemies) = (byte(2), byte(3), byte(4));
                if gravity != self.level[LEVEL_GRAVITY] {
                    self.events |= EV_GRAVITY;
                }
                self.level[LEVEL_GRAVITY] = gravity;
                self.level[LEVEL_FREEZE_ZONKS] = zonks;
                self.enemies_frozen = enemies == 1;
                return;
            }
        }
    }

    /// The cell Murphy has left is emptied; a Zonk or an Infotron resting
    /// right above starts falling, or one at the upper corner rolls in.
    fn murphy_left(&mut self, c: i32) {
        self.clear_unless_blast(c);
        let above = self.board.word(c - W);
        if above == at_rest(ZONK) || above == at_rest(INFOTRON) {
            self.board.set_state(c - W, 0x40);
            return;
        }
        if above != 0 && above != FALL_TARGET {
            return;
        }
        let upper_left = self.board.word(c - W - 1);
        if (upper_left == at_rest(ZONK) || upper_left == at_rest(INFOTRON))
            && is_round(self.board.word(c - 1))
        {
            self.board.set_state(c - W - 1, 0x60);
            self.board.set(c - W, RESERVED);
            return;
        }
        let upper_right = self.board.word(c - W + 1);
        if (upper_right == at_rest(ZONK) || upper_right == at_rest(INFOTRON))
            && is_round(self.board.word(c + 1))
        {
            self.board.set_state(c - W + 1, 0x50);
            self.board.set(c - W, RESERVED);
        }
    }

    pub(crate) fn clear_unless_blast(&mut self, c: i32) {
        if self.board.tile(c) != EXPLOSION {
            self.board.set(c, 0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn standing(rows_level: &[(i32, u8)]) -> Box<Machine> {
        let mut level = [0u8; LEVEL_BYTES];
        level[..CELLS].fill(HARDWARE);
        for &(cell, tile) in rows_level {
            level[cell as usize] = tile;
        }
        let mut m = Box::new(Machine::new());
        m.start(&level, 1);
        m
    }

    #[test]
    fn a_push_ending_on_a_burning_cell_leaves_it_burning() {
        let m0 = W + 1;
        let mut m = standing(&[(m0, MURPHY), (m0 + 1, ZONK), (m0 + 2, EMPTY)]);
        m.board.set(m0, with_state(EXPLOSION, st::PUSH_ZONK_RIGHT));
        m.finish_move(m0);
        assert_eq!(m.board.tile(m0), EXPLOSION);
        assert_eq!(m.board.word(m0 + 1), at_rest(MURPHY));
        assert_eq!(m.board.word(m0 + 2), at_rest(ZONK));
    }

    #[test]
    fn reaching_the_exit_again_wins_once() {
        let m0 = W + 1;
        let mut m = standing(&[(m0, MURPHY), (m0 + 1, EXIT)]);
        m.reach_exit(m0);
        assert!(m.completed && m.events & EV_WIN != 0);
        m.events = 0;
        m.reach_exit(m0);
        assert_eq!(m.events & EV_WIN, 0);
    }

    #[test]
    fn the_red_disk_just_set_down_is_not_picked_up() {
        let c = W + 2;
        let mut m = standing(&[(W + 1, MURPHY)]);
        m.planted = 2;
        m.planted_at = c;
        m.pick_red_disk(c);
        assert_eq!(m.disks(), 0);
        assert_eq!(m.events & EV_RED_PICKED, 0);
    }
}
