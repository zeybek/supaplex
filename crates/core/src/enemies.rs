//! Snik Snaks and Electrons. Both follow a wall: standing in a cell they
//! turn a quarter every fourth frame and look ahead, and they move a cell
//! in eight frames.
//!
//! States 0..7 turn one way (0 up, 2 left, 4 down, 6 right) and 8..15
//! the other (8 up, 10 right, 12 down, 14 left); the odd ones are halfway
//! through a turn. States 0x10, 0x18, 0x20 and 0x28 start a move up, left,
//! down and right into the cell, and count up by one each frame.

use crate::board::W;
use crate::tiles::*;
use crate::*;

const UP: u8 = 0;
const LEFT: u8 = 1;
const DOWN: u8 = 2;
const RIGHT: u8 = 3;

fn offset(dir: u8) -> i32 {
    match dir {
        UP => -W,
        LEFT => -1,
        DOWN => W,
        _ => 1,
    }
}

impl Machine {
    pub(crate) fn snik_snak(&mut self, c: i32) {
        self.enemy(c, SNIK_SNAK);
    }

    pub(crate) fn electron(&mut self, c: i32) {
        self.enemy(c, ELECTRON);
    }

    fn enemy(&mut self, c: i32, tile: u8) {
        if self.enemies_frozen || self.board.tile(c) != tile {
            return;
        }
        let state = self.board.state(c);
        match state {
            0..=15 => self.enemy_turn(c, tile, state),
            0x10..=0x2f => self.enemy_step(c, tile, state),
            _ => {}
        }
    }

    /// Standing: turn on frames 0 mod 4, look ahead on frames 3 mod 4.
    fn enemy_turn(&mut self, c: i32, tile: u8, state: u8) {
        match self.tick() & 3 {
            0 => {
                let turned = (state + 1) & 7 | (state & 8);
                self.board.set_state(c, turned);
            }
            3 => {
                let dir = match state {
                    0 | 8 => UP,
                    2 | 14 => LEFT,
                    4 | 12 => DOWN,
                    6 | 10 => RIGHT,
                    _ => return,
                };
                let ahead = c + offset(dir);
                if self.board.word(ahead) == 0 {
                    self.enemy_sets_off(c, tile, dir);
                } else if self.board.tile(ahead) == MURPHY {
                    // A Snik Snak spares Murphy while he is in a port.
                    if tile == SNIK_SNAK && matches!(self.board.state(ahead), 0x18..=0x1b) {
                        return;
                    }
                    self.explode(c, DEATH_ENEMY);
                }
            }
            _ => {}
        }
    }

    /// The enemy leaves `c`: its cell becomes a trail saying which way it
    /// went, and it appears in the next cell at the start of a move.
    fn enemy_sets_off(&mut self, c: i32, tile: u8, dir: u8) {
        self.board.set(c, with_state(TRAIL, dir + 1));
        self.board
            .set(c + offset(dir), with_state(tile, 0x10 + 8 * dir));
    }

    /// Moving into this cell; on the seventh frame the trail it left is
    /// cleared, on the eighth it decides where to go next.
    fn enemy_step(&mut self, c: i32, tile: u8, state: u8) {
        let dir = (state - 0x10) / 8;
        let frame = (state & 7) + 1;
        if frame == 7 {
            self.clear_unless_blast(c - offset(dir));
        }
        if frame < 8 {
            self.board.set_state(c, state + 1);
            return;
        }
        self.board.set(c, at_rest(tile));

        // Wall following: turn towards the side it keeps its wall on if that
        // is open, else go on, else turn away.
        let (side, turn_to_side, turn_away) = match dir {
            UP => (LEFT, 1, 9),
            LEFT => (DOWN, 3, 15),
            DOWN => (RIGHT, 5, 13),
            _ => (UP, 7, 11),
        };
        let side_cell = c + offset(side);
        if self.board.word(side_cell) == 0 || self.board.tile(side_cell) == MURPHY {
            self.board.set_state(c, turn_to_side);
            return;
        }
        let ahead = c + offset(dir);
        if self.board.word(ahead) == 0 {
            self.enemy_sets_off(c, tile, dir);
            return;
        }
        if self.board.tile(ahead) == MURPHY {
            self.explode(c, DEATH_ENEMY);
            return;
        }
        let other = c - offset(side);
        if self.board.word(other) == 0 || self.board.tile(other) == MURPHY {
            self.board.set_state(c, turn_away);
        } else {
            self.board.set_state(c, turn_to_side);
        }
    }
}
