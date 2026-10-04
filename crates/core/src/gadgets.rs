//! Orange disks, terminals, bugs and the red disk Murphy sets down.

use crate::board::{Var, W};
use crate::tiles::*;
use crate::*;

impl Machine {
    /// An orange disk falls when the cell below is empty (state 0x20 for
    /// two frames, then 0x30.. for eight frames a cell) and blows up where
    /// it lands. The cell below it holds state 8 while it is on its way.
    pub(crate) fn orange_disk(&mut self, c: i32) {
        if self.board.tile(c) != ORANGE_DISK {
            return;
        }
        let word = self.board.word(c) as i16;
        if word >= 0x3008 {
            let next = self.board.state(c).wrapping_add(1);
            if next & 7 != 0 {
                self.board.set_state(c, next);
                return;
            }
            self.board.set(c, 0);
            self.board.set(c + W, at_rest(ORANGE_DISK));
            let at = c + W;
            if self.board.word(at + W) == 0 {
                self.board.set_state(at, 0x30);
                self.board.set_state(at + W, ORANGE_DISK);
            } else if self.board.tile(at + W) != EXPLOSION {
                self.explode(at, DEATH_BLAST);
            }
        } else if word >= 0x2008 {
            if self.board.word(c + W) == 0 {
                self.board.set(c, at_rest(ORANGE_DISK));
                return;
            }
            let mut next = self.board.state(c).wrapping_add(1);
            if next == 0x22 {
                next = 0x30;
            }
            self.board.set_state(c, next);
        } else if self.board.word(c + W) == 0 {
            self.board.set_state(c, 0x20);
            self.board.set_state(c + W, ORANGE_DISK);
        }
    }

    /// A terminal's state counts up to zero; then it draws a random wait.
    pub(crate) fn terminal(&mut self, c: i32) {
        if self.board.tile(c) != TERMINAL {
            return;
        }
        let next = (self.board.state(c) as i8).wrapping_add(1);
        if next <= 0 {
            self.board.set_state(c, next as u8);
            return;
        }
        let r = self.random() as u8 & self.board.byte(Var::TerminalMask);
        self.board.set_state(c, r.wrapping_neg());
    }

    /// A bug sparks while its state is 0..13; then it draws a random quiet
    /// spell (a negative state). It acts every fourth frame.
    pub(crate) fn bug(&mut self, c: i32) {
        if self.board.tile(c) != BUG || self.tick() & 3 != 0 {
            return;
        }
        let mut next = (self.board.state(c) as i8).wrapping_add(1);
        if next == 0 {
            self.events |= EV_BUG_SPARK;
        }
        if next >= 0x0e {
            let r = (self.random() as u8 & 0x3f) + 0x20;
            next = (r as i8).wrapping_neg();
        }
        self.board.set_state(c, next as u8);
    }

    /// Once set down, the red disk shows in its cell when Murphy has left
    /// it and blows up 38 frames later.
    pub(crate) fn burn_red_disk(&mut self) {
        if (self.planted as i8) <= 1 {
            return;
        }
        let at = self.planted_at;
        if self.board.word(at) == 0 {
            self.board.set(at, at_rest(RED_DISK));
        }
        self.planted = self.planted.wrapping_add(1);
        if (self.planted as i8) >= 0x28 {
            self.explode(at, DEATH_BLAST);
            self.planted = 0;
        }
    }
}
