//! Zonks and Infotrons: resting, starting to fall or roll, falling a cell,
//! rolling off round things, and landing.
//!
//! The state's high nibble is the motion and the low nibble its frame:
//! 0x10 falling into this cell, 0x20 / 0x30 rolled in from the right /
//! left, 0x40 about to fall, 0x50 / 0x60 about to roll left / right, 0x70
//! waiting to fall on. Zonks and Infotrons share almost all of it; the
//! differences are noted where they are.

use crate::board::W;
use crate::tiles::*;
use crate::*;

#[derive(Clone, Copy, PartialEq)]
enum Kind {
    Zonk,
    Infotron,
}

impl Kind {
    fn tile(self) -> u8 {
        match self {
            Kind::Zonk => ZONK,
            Kind::Infotron => INFOTRON,
        }
    }
}

impl Machine {
    pub(crate) fn zonk(&mut self, c: i32) {
        self.faller(c, Kind::Zonk);
    }

    pub(crate) fn infotron(&mut self, c: i32) {
        self.faller(c, Kind::Infotron);
    }

    /// Only Zonks can be frozen.
    fn frozen(&self, kind: Kind) -> bool {
        kind == Kind::Zonk && self.zonks_are_frozen()
    }

    fn faller(&mut self, c: i32, kind: Kind) {
        if self.board.tile(c) != kind.tile() {
            return;
        }
        if self.board.word(c) == at_rest(kind.tile()) {
            if self.frozen(kind) {
                return;
            }
            let below = self.board.word(c + W);
            if below == 0 {
                self.board.set_state(c, 0x40);
            } else if !(is_round(below) && self.start_roll(c, kind)) {
                return;
            }
        }
        self.faller_motion(c, kind);
    }

    /// On something round: roll off to the left if there is room there,
    /// else to the right. Returns whether a roll started.
    fn start_roll(&mut self, c: i32, kind: Kind) -> bool {
        if is_open_beside(self.board.word(c + W - 1)) && self.board.word(c - 1) == 0 {
            self.board.set_state(c, 0x50);
            self.board.set(c - 1, RESERVED);
            return true;
        }
        self.start_roll_right(c, kind)
    }

    fn start_roll_right(&mut self, c: i32, kind: Kind) -> bool {
        if !is_open_beside(self.board.word(c + W + 1)) {
            return false;
        }
        let right = self.board.word(c + 1);
        // A Zonk also rolls right onto a cell another Zonk is falling into.
        let room = right == 0
            || (kind == Kind::Zonk
                && right == FALL_TARGET
                && self.board.word(c - W + 1) == at_rest(ZONK));
        if !room {
            return false;
        }
        self.board.set_state(c, 0x60);
        self.board.set(c + 1, RESERVED);
        true
    }

    fn faller_motion(&mut self, c: i32, kind: Kind) {
        let state = self.board.state(c);
        match state & 0xf0 {
            0x10 => self.fall_frame(c, kind),
            0x20 => self.rolled_in(c, kind, 1),
            0x30 => self.rolled_in(c, kind, -1),
            _ if self.frozen(kind) => {}
            0x40 => self.about_to_fall(c, kind),
            0x50 => self.about_to_roll(c, kind, -1),
            0x60 => self.about_to_roll(c, kind, 1),
            0x70 => {
                let below = self.board.word(c + W);
                if below == 0 || below == FALL_TARGET {
                    self.board.set(c, LEAVING);
                    self.board.set(c + W, with_state(kind.tile(), 0x10));
                    self.fall_frame(c + W, kind);
                }
            }
            _ => {}
        }
    }

    /// Waits a frame, then falls into the cell below if it is still empty.
    fn about_to_fall(&mut self, c: i32, kind: Kind) {
        let next = self.board.state(c) + 1;
        if next < 0x42 {
            self.board.set_state(c, next);
        } else if self.board.word(c + W) != 0 {
            self.board.set_state(c, next - 1);
        } else {
            self.board.set(c, LEAVING);
            self.board.set(c + W, with_state(kind.tile(), 0x10));
        }
    }

    /// Waits a frame, then rolls into the cell at the side (`d` -1 left,
    /// +1 right) if it and the cell under it are free.
    fn about_to_roll(&mut self, c: i32, kind: Kind, d: i32) {
        let next = self.board.state(c) + 1;
        let last = if d < 0 { 0x52 } else { 0x62 };
        if next < last {
            self.board.set_state(c, next);
            return;
        }
        let side = self.board.word(c + d);
        if self.board.word(c + W + d) != 0 || (side != 0 && side != RESERVED) {
            self.board.set_state(c, next - 1);
            return;
        }
        self.board.set(c, LEAVING);
        let rolled = if d < 0 { 0x22 } else { 0x32 };
        self.board.set(c + d, with_state(kind.tile(), rolled));
        let under = match kind {
            Kind::Zonk => LEAVING,
            Kind::Infotron => FALL_TARGET,
        };
        self.board.set(c + W + d, under);
    }

    /// Rolled into this cell from `from` (+1: from the right, -1: from the
    /// left); at the end it drops into the cell below.
    fn rolled_in(&mut self, c: i32, kind: Kind, from: i32) {
        let base = if from > 0 { 0x20 } else { 0x30 };
        let next = self.board.state(c) + 1;
        if next == base + 4 {
            self.board.set(c + from, ROLLED_FROM);
        }
        if next == base + 6 {
            self.board.set_state(c, next);
            self.faller_left(c + from, kind);
            return;
        }
        if next < base + 8 {
            self.board.set_state(c, next);
            return;
        }
        match kind {
            Kind::Zonk => {
                self.board.set(c, LEAVING);
                self.board.set(c + W, with_state(ZONK, 0x10));
            }
            Kind::Infotron => self.board.set(c, with_state(INFOTRON, 0x70)),
        }
    }

    /// One frame of falling into this cell; on the last, see what is below.
    fn fall_frame(&mut self, c: i32, kind: Kind) {
        let next = self.board.state(c) + 1;
        if next == 0x16 {
            self.board.set_state(c, next);
            self.faller_left(c - W, kind);
            return;
        }
        if next < 0x18 {
            self.board.set_state(c, next);
            return;
        }
        self.board.set_state(c, 0);
        if self.frozen(kind) {
            return;
        }
        self.land(c, kind);
    }

    /// A fall into cell `c` has ended: fall on, hit something, or come to
    /// rest (and maybe roll off).
    fn land(&mut self, c: i32, kind: Kind) {
        let below_cell = c + W;
        let below = self.board.word(below_cell);
        let below_tile = below as u8;
        if below == 0 || below == FALL_TARGET {
            self.board.set(c, with_state(kind.tile(), 0x70));
            self.board.set(below_cell, FALL_TARGET);
            return;
        }
        if below_tile == MURPHY {
            // Murphy leaning sideways on something is not hit.
            if matches!(
                self.board.state(below_cell),
                0x0e | 0x0f | 0x28 | 0x29 | 0x25 | 0x26
            ) {
                return;
            }
            match kind {
                Kind::Zonk => self.zonk_hits_trail(c, -1),
                Kind::Infotron => self.explode(below_cell, DEATH_CRUSHED),
            }
            return;
        }
        match kind {
            Kind::Zonk => {
                if below_tile == SNIK_SNAK || below_tile == ELECTRON {
                    return self.explode(below_cell, DEATH_BLAST);
                }
                if below == with_state(TRAIL, 2) {
                    return self.zonk_hits_trail(c, -1);
                }
                if below == with_state(TRAIL, 4) {
                    return self.zonk_hits_trail(c, 1);
                }
                if below == at_rest(ORANGE_DISK) {
                    self.board.set_timer(below_cell, 6);
                    return;
                }
            }
            Kind::Infotron => {
                if below == at_rest(RED_DISK)
                    || below_tile == SNIK_SNAK
                    || below_tile == ELECTRON
                    || below == at_rest(YELLOW_DISK)
                    || below == at_rest(ORANGE_DISK)
                {
                    return self.explode(below_cell, DEATH_BLAST);
                }
            }
        }

        self.events |= EV_LANDED;
        if !is_round(below) {
            return;
        }
        if is_open_beside(self.board.word(c + W - 1)) {
            if self.board.word(c - 1) == 0 {
                self.board.set_state(c, 0x50);
                self.board.set(c - 1, RESERVED);
            } else if self.start_roll_right(c, kind) {
                self.faller_motion(c, kind);
            }
            return;
        }
        if is_open_beside(self.board.word(c + W + 1)) && self.board.word(c + 1) == 0 {
            self.board.set_state(c, 0x60);
            self.board.set(c + 1, RESERVED);
        }
    }

    /// A Zonk lands on a cell an enemy is leaving sideways (or on Murphy,
    /// where the game runs the same code): the enemy beside it, at `side`,
    /// is taken out and the cell below blows up, as an Electron if the enemy
    /// was one.
    fn zonk_hits_trail(&mut self, c: i32, side: i32) {
        let below = c + W;
        let beside = below + side;
        if self.board.tile(beside) == ELECTRON {
            self.board.set(below, at_rest(ELECTRON));
        }
        self.clear_unless_blast(beside);
        let cause = if self.board.tile(below) == MURPHY {
            DEATH_CRUSHED
        } else {
            DEATH_BLAST
        };
        self.explode(below, cause);
    }

    /// A Zonk pushed onto an enemy or a cell an enemy is leaving blows it up.
    pub(crate) fn zonk_lands_on_enemy(&mut self, zonk: i32) {
        let tile = self.board.tile(zonk + W);
        if tile == SNIK_SNAK || tile == TRAIL {
            self.explode(zonk + W, DEATH_BLAST);
        }
    }

    /// The cell a Zonk or Infotron has left is emptied; something resting
    /// above may start to roll into the gap. A Zonk lets Zonks in, an
    /// Infotron Infotrons.
    fn faller_left(&mut self, c: i32, kind: Kind) {
        self.clear_unless_blast(c);
        let above = self.board.word(c - W);
        let other = match kind {
            Kind::Zonk => INFOTRON,
            Kind::Infotron => ZONK,
        };
        let open = above == 0 || (above == FALL_TARGET && self.board.tile(c - 2 * W) == other);
        if !open {
            return;
        }
        let me = at_rest(kind.tile());
        if self.board.word(c - W - 1) == me && is_round(self.board.word(c - 1)) {
            self.board.set(c - W - 1, with_state(kind.tile(), 0x60));
            self.board.set(c - W, RESERVED);
            return;
        }
        if self.board.word(c - W + 1) == me && is_round(self.board.word(c + 1)) {
            self.board.set(c - W + 1, with_state(kind.tile(), 0x50));
            self.board.set(c - W, RESERVED);
        }
    }
}
