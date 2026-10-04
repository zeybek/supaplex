//! The WebAssembly module: one game, and after every frame its tiles and
//! states turned into per-cell arrays a page can draw. Fixed arrays only,
//! and every read checked by hand, so the module has no panic path
//! (`src/generated.test.ts` holds it to that).

#![cfg_attr(target_arch = "wasm32", no_std)]

pub use supaplex_core::Machine;

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

pub const CAUSE_NONE: u8 = 0;
pub const CAUSE_CRUSHED: u8 = 1;
pub const CAUSE_ENEMY: u8 = 2;
pub const CAUSE_BLAST: u8 = 3;
pub const CAUSE_BUG: u8 = 4;

/// The game's own code for a burning cell; the page's is EXPLOSION.
const BURNING: u8 = 0x1f;

pub const W: usize = 60;
pub const H: usize = 24;
pub const N: usize = W * H;
pub const LEVEL_BYTES: usize = 1536;

// A cell's kind: up to 25, and 40, the level file's codes, decorations as
// RAM and HARDWARE; the last four come from the game's states.
pub const SPACE: u8 = 0;
pub const ZONK: u8 = 1;
pub const BASE: u8 = 2;
pub const MURPHY: u8 = 3;
pub const INFOTRON: u8 = 4;
pub const RAM: u8 = 5;
pub const HARDWARE: u8 = 6;
pub const EXIT: u8 = 7;
pub const ORANGE: u8 = 8;
pub const PORT_RIGHT: u8 = 9;
pub const PORT_DOWN: u8 = 10;
pub const PORT_LEFT: u8 = 11;
pub const PORT_UP: u8 = 12;
pub const SPECIAL_RIGHT: u8 = 13;
pub const SPECIAL_DOWN: u8 = 14;
pub const SPECIAL_LEFT: u8 = 15;
pub const SPECIAL_UP: u8 = 16;
pub const SNIK_SNAK: u8 = 17;
pub const YELLOW: u8 = 18;
pub const TERMINAL: u8 = 19;
pub const RED: u8 = 20;
pub const PORT_VERTICAL: u8 = 21;
pub const PORT_HORIZONTAL: u8 = 22;
pub const PORT_CROSS: u8 = 23;
pub const ELECTRON: u8 = 24;
pub const BUG: u8 = 25;
pub const INVISIBLE: u8 = 40;
pub const VACATING: u8 = 41;
pub const EXPLOSION: u8 = 42;
pub const RED_LIT: u8 = 43;
pub const RESERVED: u8 = 44;

pub const UP: u8 = 0;
pub const LEFT: u8 = 1;
pub const DOWN: u8 = 2;
pub const RIGHT: u8 = 3;
const STEPS: [i32; 4] = [-(W as i32), -1, W as i32, 1];

pub const STEP: u8 = 8;
pub const SLIDE: u8 = 6;

pub const F_MOVING: u8 = 1;
pub const F_TURNING: u8 = 2;
pub const F_CLOCKWISE: u8 = 4;
pub const F_ACTIVE: u8 = 8;
pub const F_FUSED: u8 = 16;
pub const F_ELECTRON: u8 = 32;

pub const AT_REST: u8 = 0;
pub const SETTLING: u8 = 1;
pub const TIPPING: u8 = 2;
pub const ROLLING: u8 = 3;
pub const FALLING: u8 = 4;
pub const SHOVED: u8 = 5;

pub const PLAYING: u8 = 0;
pub const WON: u8 = 1;
pub const DYING_STATUS: u8 = 2;
pub const DEAD: u8 = 3;

pub const IDLE: u8 = 0;
pub const WALK: u8 = 1;
pub const PUSHING: u8 = 2;
pub const SNAPPING: u8 = 3;
pub const THROUGH_PORT: u8 = 4;
pub const LEAVING: u8 = 6;
pub const GONE: u8 = 7;
pub const LEANING: u8 = 8;
pub const PLANTING: u8 = 9;

const FUSE: u8 = 0x28;

/// A game and the arrays a page draws of it, updated after every frame.
#[derive(Clone)]
pub struct Game {
    pub level: [u8; LEVEL_BYTES],
    pub machine: Machine,
    pub kind: [u8; N],
    pub look: [u8; N],
    /// For Snik Snaks and Electrons, in eighths of a turn.
    pub dir: [u8; N],
    pub prog: [u8; N],
    pub flags: [u8; N],
    pub phase: [u8; N],
    pub timer: [u16; N],

    pub tick: u32,
    pub status: u8,
    /// The cell Murphy is drawn in: the one he is going to, while he moves.
    pub murphy: usize,
    pub murphy_dir: u8,
    pub action: u8,
    pub action_tick: u8,
    pub action_len: u8,
}

impl Game {
    pub const fn new() -> Game {
        Game {
            level: [0; LEVEL_BYTES],
            machine: Machine::new(),
            kind: [0; N],
            look: [0; N],
            dir: [0; N],
            prog: [0; N],
            flags: [0; N],
            phase: [0; N],
            timer: [0; N],
            tick: 0,
            status: PLAYING,
            murphy: 0,
            murphy_dir: UP,
            action: IDLE,
            action_tick: 0,
            action_len: 0,
        }
    }

    /// False when the level has no Murphy.
    pub fn start(&mut self, seed: u32) -> bool {
        if !self.level[..N].contains(&MURPHY) {
            return false;
        }
        self.machine.start(&self.level, seed as u16);
        self.tick = 0;
        self.status = PLAYING;
        for c in 0..N {
            self.look[c] = self.level[c];
        }
        self.derive();
        true
    }

    /// Murphy is out through the exit, or the blast that took him burnt out.
    pub fn over(&self) -> bool {
        self.status == DEAD
            || (self.status == WON && (self.action == GONE || self.machine.quit_countdown() == 0))
    }

    /// `input` as in a demo; returns `EV_*` bits.
    pub fn step(&mut self, input: u8) -> u32 {
        if self.over() {
            return 0;
        }
        self.tick = self.tick.wrapping_add(1);
        self.machine.frame(input & 0x0f);
        match self.status {
            PLAYING if self.machine.completed() => self.status = WON,
            PLAYING if self.machine.killed() => self.status = DYING_STATUS,
            DYING_STATUS if self.machine.quit_countdown() == 0 => self.status = DEAD,
            _ => {}
        }
        self.derive();
        self.machine.events()
    }

    /// While it burns: its cell and the frames left.
    pub fn planted(&self) -> Option<(usize, u8)> {
        let (countdown, cell) = self.machine.planted();
        if countdown < 2 {
            return None;
        }
        Some((cell as usize, FUSE.saturating_sub(countdown)))
    }

    fn derive(&mut self) {
        let lit = self.planted().map(|(c, _)| c);
        for c in 0..N {
            let p = c as i32;
            let (t, s) = (self.machine.tile(p), self.machine.state(p));
            let (mut kind, mut dir, mut prog, mut flags, mut phase, mut timer) =
                (t, 0u8, 0u8, 0u8, AT_REST, 0u16);
            match t {
                SPACE if s != 0 => kind = RESERVED,
                ZONK | INFOTRON => match s {
                    0x10..=0x17 => (flags, dir, prog, phase) = (F_MOVING, DOWN, s - 0x10, FALLING),
                    0x22..=0x27 => (flags, dir, prog, phase) = (F_MOVING, LEFT, s - 0x22, ROLLING),
                    0x32..=0x37 => (flags, dir, prog, phase) = (F_MOVING, RIGHT, s - 0x32, ROLLING),
                    0x40 | 0x41 => phase = SETTLING,
                    0x50 | 0x51 | 0x60 | 0x61 => phase = TIPPING,
                    _ => {}
                },
                // Murphy just left it, down onto an Infotron.
                BASE if s != 0 => kind = VACATING,
                ORANGE => {
                    if s == 0x20 || s == 0x21 {
                        phase = SETTLING;
                    }
                }
                PORT_RIGHT..=PORT_UP if s == 1 => kind = t + 4,
                SNIK_SNAK | ELECTRON => match s {
                    0..=7 => (flags, dir) = (F_TURNING, s),
                    8..=15 => (flags, dir) = (F_TURNING | F_CLOCKWISE, (8 - (s - 8)) & 7),
                    // Moving: 0x10 up, 0x18 left, 0x20 down, 0x28 right, a
                    // frame a step.
                    _ => {
                        flags = F_MOVING;
                        dir = (((s - 0x10) >> 3) & 3) * 2;
                        prog = s & 7;
                    }
                },
                RED if lit == Some(c) => kind = RED_LIT,
                BUG => {
                    if s < 0x80 {
                        flags = F_ACTIVE;
                    }
                }
                BURNING => {
                    kind = EXPLOSION;
                    if s & 0x80 != 0 {
                        flags = F_ELECTRON;
                        timer = 0x89u16.saturating_sub(s as u16) * 4;
                    } else {
                        timer = 8u16.saturating_sub(s as u16) * 4;
                    }
                }
                0xaa | 0xbb | 0xff => kind = VACATING,
                // The game's other markers: a cell promised to something.
                _ if t > INVISIBLE => kind = RESERVED,
                _ => {}
            }
            if matches!(t, ORANGE | YELLOW | SNIK_SNAK) && self.machine.timer(c) != 0 {
                flags |= F_FUSED;
            }
            self.kind[c] = kind;
            self.dir[c] = dir;
            self.prog[c] = prog;
            self.flags[c] = flags;
            self.phase[c] = phase;
            self.timer[c] = timer;
        }
        // An orange disk falls in the cell it leaves; it is drawn arriving
        // in the one below, as everything else is.
        for c in 0..N - W {
            let p = c as i32;
            let s = self.machine.state(p);
            if self.machine.tile(p) == ORANGE && (0x30..=0x37).contains(&s) {
                let fused = self.flags[c] & F_FUSED;
                self.put(c, VACATING, 0, 0, 0, AT_REST);
                self.put(c + W, ORANGE, DOWN, s - 0x30, F_MOVING | fused, FALLING);
            }
        }
        self.read_murphy();
    }

    /// A cell off the field is ignored.
    fn put(&mut self, c: usize, kind: u8, dir: u8, prog: u8, flags: u8, phase: u8) {
        if c >= N {
            return;
        }
        self.kind[c] = kind;
        self.dir[c] = dir;
        self.prog[c] = prog;
        self.flags[c] = flags;
        self.phase[c] = phase;
    }

    /// Murphy's action, and where he and what he pushes are drawn mid-move.
    fn read_murphy(&mut self) {
        let r = &self.machine;
        let p = r.murphy();
        let s = if r.tile(p) == MURPHY { r.state(p) } else { 0 };
        let (frame, frames) = r.animation();
        let leaning = r.push_counter() > 0;
        let (mut cell, mut dir, mut action, mut tick, mut len) = (p, r.facing(), IDLE, 0, 0);
        let mut pushed = None;
        match s {
            1..=12 => (dir, action, tick, len) = ((s - 1) & 3, WALK, frame, frames),
            0x0d => (action, tick, len) = (LEAVING, frame, frames),
            0x0e | 0x0f | 0x24..=0x29 => {
                dir = match s {
                    0x24 => UP,
                    0x0e | 0x25 | 0x28 => LEFT,
                    0x27 => DOWN,
                    _ => RIGHT,
                };
                if leaning {
                    action = LEANING;
                } else {
                    let ahead = p + STEPS[(dir & 3) as usize];
                    pushed = Some((ahead + STEPS[(dir & 3) as usize], r.tile(ahead)));
                    (cell, action, tick, len) = (ahead, PUSHING, frame, frames);
                }
            }
            0x10..=0x17 | 0x20..=0x23 => (dir, action) = (s & 3, SNAPPING),
            0x18..=0x1b => {
                dir = s - 0x18;
                cell = p + 2 * STEPS[(dir & 3) as usize];
                (action, tick, len) = (THROUGH_PORT, frame, frames);
            }
            // A red disk above or below: he goes into its cell at the end.
            0x1c | 0x1e => {
                dir = if s == 0x1c { UP } else { DOWN };
                cell = p + STEPS[(dir & 3) as usize];
                (action, tick, len) = (WALK, frame, frames);
            }
            0x1d | 0x1f => {
                dir = if s == 0x1d { LEFT } else { RIGHT };
                (action, tick, len) = (WALK, frame, frames);
            }
            0x2a => {
                action = PLANTING;
                tick = (0x40 - r.push_counter().min(0x40)).min(0x20);
                len = 0x20;
            }
            _ => {}
        }
        let over = self.status == DYING_STATUS || self.status == DEAD;
        if over || (self.status == WON && action != LEAVING) {
            action = GONE;
        }
        let cell = cell.clamp(0, N as i32 - 1) as usize;
        // Without walls round the level, Murphy can walk off the field.
        let on_field = (0..N as i32).contains(&p);
        if action != GONE && on_field && cell != p as usize {
            self.put(p as usize, VACATING, 0, 0, 0, AT_REST);
            self.put(cell, MURPHY, 0, 0, 0, AT_REST);
            if let Some((to, what)) = pushed
                && (0..N as i32).contains(&to)
            {
                self.put(to as usize, what, dir, frame, F_MOVING, SHOVED);
            }
        }
        self.murphy = cell;
        self.murphy_dir = dir;
        self.action = action;
        self.action_tick = tick;
        self.action_len = len;
    }
}

impl Default for Game {
    fn default() -> Self {
        Game::new()
    }
}

// All zeroes at rest, so the module's one game costs no bytes in its file.
static mut GAME: Game = Game::new();

static mut KEYS: [u8; KEY_BUFFER] = [0; KEY_BUFFER];
const KEY_BUFFER: usize = 4096;

#[inline]
fn game() -> &'static mut Game {
    // One thread: each page or server has its own instance.
    unsafe { &mut *core::ptr::addr_of_mut!(GAME) }
}

/// The whole game: copy [`state_len`] bytes out to save, back in to restore.
#[unsafe(no_mangle)]
pub extern "C" fn state() -> *mut u8 {
    core::ptr::addr_of_mut!(GAME).cast()
}

#[unsafe(no_mangle)]
pub extern "C" fn state_len() -> u32 {
    core::mem::size_of::<Game>() as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn keys_buffer() -> *mut u8 {
    core::ptr::addr_of_mut!(KEYS).cast()
}

#[unsafe(no_mangle)]
pub extern "C" fn keys_len() -> u32 {
    KEY_BUFFER as u32
}

/// Plays `count` keys from [`keys_buffer`], stopping when the game ends.
#[unsafe(no_mangle)]
pub extern "C" fn run(count: u32) -> u32 {
    let g = game();
    // SAFETY: one thread; the page writes the keys only between calls.
    let keys = unsafe { &*core::ptr::addr_of!(KEYS) };
    let mut played = 0;
    for &key in keys.iter().take(count as usize) {
        if g.status != PLAYING {
            break;
        }
        g.step(key);
        played += 1;
    }
    played
}

#[unsafe(no_mangle)]
pub extern "C" fn level_buffer() -> *mut u8 {
    game().level.as_mut_ptr()
}

/// 1 when it started, 0 when the level has no Murphy.
#[unsafe(no_mangle)]
pub extern "C" fn start(seed: u32) -> u32 {
    game().start(seed) as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn step(input: u32) -> u32 {
    game().step(input as u8)
}

#[unsafe(no_mangle)]
pub extern "C" fn kinds() -> *const u8 {
    game().kind.as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn looks() -> *const u8 {
    game().look.as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn dirs() -> *const u8 {
    game().dir.as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn progs() -> *const u8 {
    game().prog.as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn cell_flags() -> *const u8 {
    game().flags.as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn phases() -> *const u8 {
    game().phase.as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn timers() -> *const u16 {
    game().timer.as_ptr()
}

/// 0 tick, 1 status, 2 Infotrons needed, 3 left, 4 red disks, 5 gravity,
/// 6 frozen Zonks, 7 frozen enemies, 8 Murphy's cell, 9 his direction,
/// 10 his action, 11 and 12 its frame and length, 13 and 14 the planted
/// disk's cell (-1 for none) and frames left, 15 and 16 the death's cause
/// and cell; -1 otherwise.
#[unsafe(no_mangle)]
pub extern "C" fn stat(which: u32) -> i32 {
    let g = game();
    let r = &g.machine;
    match which {
        0 => g.tick as i32,
        1 => g.status as i32,
        2 => r.infotrons_needed() as i32,
        3 => r.infotrons_left() as i32,
        4 => r.red_disks() as i32,
        5 => r.gravity() as i32,
        6 => r.zonks_frozen() as i32,
        7 => r.enemies_frozen() as i32,
        8 => g.murphy as i32,
        9 => g.murphy_dir as i32,
        10 => g.action as i32,
        11 => g.action_tick as i32,
        12 => g.action_len as i32,
        13 => g.planted().map_or(-1, |(c, _)| c as i32),
        14 => g.planted().map_or(0, |(_, fuse)| fuse as i32),
        15 => r.death().0 as i32,
        16 => r.death().1,
        _ => -1,
    }
}

#[cfg(target_arch = "wasm32")]
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

#[cfg(test)]
mod tests;
