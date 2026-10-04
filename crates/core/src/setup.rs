//! Starting a level: loading it into the cells, the game's clean-up of
//! the loaded tiles, the Infotron count and finding Murphy.

use crate::board::{Var, W};
use crate::tiles::*;
use crate::{CELLS, LEVEL_BYTES, Machine};

const LEVEL_INFOTRONS: usize = 1470;

impl Machine {
    pub(crate) fn load(&mut self, level: &[u8; LEVEL_BYTES], seed: u16) {
        *self = Machine::new();
        self.level = *level;
        self.seed = seed;
        // The game's level start resets these (the frame counter's
        // initial value in the data segment is 0xf000).
        self.board.reset();
        self.set_tick(0);
        self.board.set_byte(Var::TerminalMask, 0x7f);

        // Every byte of the level becomes a cell with state 0, the settings
        // after the field included.
        for (cell, &tile) in level.iter().enumerate() {
            self.board.set(cell as i32, at_rest(tile));
        }

        let infotrons = self.prepare_cells();
        let needed = match self.level[LEVEL_INFOTRONS] {
            0 => infotrons,
            n => n,
        };
        self.set_infotrons(needed);
        self.board.set_byte(Var::InfotronsShown, needed);
        self.infotrons_needed = needed;

        // The first Murphy in the field; the last cell if there is none.
        self.murphy_at = (0..CELLS as i32)
            .find(|&c| self.board.word(c) == at_rest(MURPHY))
            .unwrap_or(CELLS as i32 - 1);
        self.murphy_seen_at = self.murphy_at;
    }

    /// Goes once over the field: counts the Infotrons, sets the enemies
    /// moving, turns the variant chips and hardware into the plain ones and
    /// special ports into plain ports marked with state 1.
    fn prepare_cells(&mut self) -> u8 {
        let mut infotrons = 0u8;
        for c in 0..CELLS as i32 {
            let word = self.board.word(c);
            match word {
                0x04 => infotrons = infotrons.wrapping_add(1),
                0x11 | 0x18 => self.wake_enemy(c, word as u8),
                0x1a | 0x1b | 0x26 | 0x27 => self.board.set(c, at_rest(CHIP)),
                0x1c..=0x25 => self.board.set(c, at_rest(HARDWARE)),
                0x0d..=0x10 => {
                    self.board
                        .set_tile(c, word as u8 - (SPECIAL_PORT_RIGHT - PORT_RIGHT));
                    self.board.set_state(c, 1);
                }
                _ => {}
            }
        }
        infotrons
    }

    /// An enemy with room at its left starts turning there; otherwise it
    /// starts moving up or right if it can.
    fn wake_enemy(&mut self, c: i32, tile: u8) {
        if self.board.word(c - 1) == 0 {
            self.board.set_state(c, 1);
        } else if self.board.word(c - W) == 0 {
            self.board.set(c - W, with_state(tile, 0x10));
            self.board.set(c, LEAVING);
        } else if self.board.word(c + 1) == 0 {
            self.board.set(c + 1, with_state(tile, 0x28));
            self.board.set(c, LEAVING);
        }
    }
}
