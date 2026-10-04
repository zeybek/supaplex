//! Explosions: the 3 x 3 blast, the delayed blasts it sets off, and the
//! explosion animation that leaves an empty cell or an Infotron.

use crate::board::W;
use crate::tiles::*;
use crate::*;

/// An ordinary blast, and one from an Electron that leaves Infotrons.
const BLAST: u16 = with_state(EXPLOSION, 0);
const INFOTRON_BLAST: u16 = with_state(EXPLOSION, 0x80);
/// Frames before a blast reaches the disks and enemies it caught.
const CHAIN_DELAY: i8 = 13;

impl Machine {
    /// Blow up the 3 x 3 cells around `c` (hardware stays). `cause` is what
    /// Murphy died of if he is in it.
    pub(crate) fn explode(&mut self, c: i32, cause: u8) {
        let centre = self.board.tile(c);
        if centre == HARDWARE {
            return;
        }
        self.shaking = true;
        self.events |= EV_EXPLOSION;
        if centre == MURPHY {
            self.murphy_hit(c, cause);
        }
        let (fill, delay) = if centre == ELECTRON {
            (INFOTRON_BLAST, -CHAIN_DELAY)
        } else {
            (BLAST, CHAIN_DELAY)
        };
        for d in [-W - 1, -W, -W + 1, -1] {
            self.blast_reaches(c + d, fill, delay, cause);
        }
        self.board.set(c, fill);
        for d in [1, W - 1, W, W + 1] {
            self.blast_reaches(c + d, fill, delay, cause);
        }
    }

    fn murphy_hit(&mut self, c: i32, cause: u8) {
        self.murphy_caught = true;
        if self.death_cause == 0 && !self.completed {
            self.death_cause = cause;
            self.death_cell = c;
        }
    }

    /// One cell around a blast. Disks, Snik Snaks, Electrons and Murphy go
    /// off themselves after a delay (an Electron's blast, and a blast from
    /// an Electron, leave Infotrons: a negative delay); a moving Zonk or
    /// Infotron takes the cells it was moving between with it.
    fn blast_reaches(&mut self, n: i32, fill: u16, delay: i8, cause: u8) {
        let word = self.board.word(n);
        let state = (word >> 8) as u8;
        match word as u8 {
            HARDWARE => {}
            ORANGE_DISK | YELLOW_DISK | SNIK_SNAK => {
                self.board.set_timer(n, delay);
                self.board.set(n, fill);
            }
            MURPHY => {
                self.murphy_hit(n, cause);
                self.board.set_timer(n, delay);
                self.board.set(n, fill);
            }
            ELECTRON => {
                self.board.set_timer(n, delay.wrapping_neg());
                self.board.set(n, INFOTRON_BLAST);
            }
            ZONK => {
                self.board.set(n, fill);
                self.blast_takes_motion(n, state, true);
            }
            INFOTRON => {
                self.board.set(n, fill);
                self.blast_takes_motion(n, state, false);
            }
            _ => self.board.set(n, fill),
        }
    }

    /// Clears the cells a falling or rolling object at `n` had kept. A Zonk
    /// that rolled in sideways always clears the cell below; an Infotron
    /// only when it was kept for its fall.
    fn blast_takes_motion(&mut self, n: i32, state: u8, zonk: bool) {
        let clear_below_if_kept = |me: &mut Self| {
            if me.board.word(n + W) == FALL_TARGET {
                me.clear_unless_blast(n + W);
            }
        };
        match state & 0xf0 {
            0x10 | 0x70 => {
                self.clear_unless_blast(n - W);
                clear_below_if_kept(self);
            }
            0x20 | 0x30 => {
                let from = if state & 0xf0 == 0x20 { n + 1 } else { n - 1 };
                self.clear_unless_blast(from);
                if zonk {
                    self.clear_unless_blast(n + W);
                } else {
                    clear_below_if_kept(self);
                }
            }
            0x50 => self.clear_unless_blast(n - 1),
            0x60 => self.clear_unless_blast(n + 1),
            _ => {}
        }
    }

    /// The explosion animation, a step every fourth frame: after eight it
    /// leaves an empty cell, or after nine an Infotron.
    pub(crate) fn explosion_tick(&mut self, c: i32) {
        if self.board.tile(c) != EXPLOSION || self.tick() & 3 != 0 {
            return;
        }
        let state = self.board.state(c);
        let next = state.wrapping_add(1);
        if state & 0x80 == 0 {
            self.board.set_state(c, next);
            if next == 8 {
                self.board.set(c, 0);
                self.shaking = false;
            }
        } else if next == 0x89 {
            self.board.set(c, at_rest(INFOTRON));
            self.shaking = false;
        } else {
            self.board.set_state(c, next);
        }
    }

    /// The delayed blasts: every cell's timer counts towards zero and the
    /// cell blows up when it gets there (as an Electron when it counted up
    /// from below zero).
    pub(crate) fn count_down_blasts(&mut self) {
        for c in 0..CELLS as i32 {
            let t = self.board.timer(c);
            if t > 0 {
                self.board.set_timer(c, t - 1);
                if t == 1 {
                    self.explode(c, DEATH_BLAST);
                }
            } else if t < 0 {
                self.board.set_timer(c, t + 1);
                if t == -1 {
                    self.board.set(c, with_state(ELECTRON, 0xff));
                    self.explode(c, DEATH_BLAST);
                }
            }
        }
    }
}
