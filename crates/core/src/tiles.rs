//! Tile codes (the low byte of a cell) and the whole-word markers the game
//! leaves in cells that something is moving into or out of.

pub const EMPTY: u8 = 0x00;
pub const ZONK: u8 = 0x01;
pub const BASE: u8 = 0x02;
pub const MURPHY: u8 = 0x03;
pub const INFOTRON: u8 = 0x04;
pub const CHIP: u8 = 0x05;
pub const HARDWARE: u8 = 0x06;
pub const EXIT: u8 = 0x07;
pub const ORANGE_DISK: u8 = 0x08;
pub const PORT_RIGHT: u8 = 0x09;
pub const PORT_DOWN: u8 = 0x0a;
pub const PORT_LEFT: u8 = 0x0b;
pub const PORT_UP: u8 = 0x0c;
pub const SPECIAL_PORT_RIGHT: u8 = 0x0d;
pub const SNIK_SNAK: u8 = 0x11;
pub const YELLOW_DISK: u8 = 0x12;
pub const TERMINAL: u8 = 0x13;
pub const RED_DISK: u8 = 0x14;
pub const PORT_VERTICAL: u8 = 0x15;
pub const PORT_HORIZONTAL: u8 = 0x16;
pub const PORT_CROSS: u8 = 0x17;
pub const ELECTRON: u8 = 0x18;
pub const BUG: u8 = 0x19;
pub const EXPLOSION: u8 = 0x1f;
/// The cell an enemy is leaving; its state says which way it went (1 up,
/// 2 left, 3 down, 4 right).
pub const TRAIL: u8 = 0xbb;

/// A cell kept free for a Zonk or an Infotron rolling into it.
pub const RESERVED: u16 = 0x8888;
/// The cell under a falling Zonk or Infotron, kept for it.
pub const FALL_TARGET: u16 = 0x9999;
/// The cell a rolling object has just left.
pub const ROLLED_FROM: u16 = 0xaaaa;
/// A cell an object is leaving.
pub const LEAVING: u16 = 0xffff;

/// The word of a tile with state 0.
pub const fn at_rest(tile: u8) -> u16 {
    tile as u16
}

/// The word of a tile with a state.
pub const fn with_state(tile: u8, state: u8) -> u16 {
    tile as u16 | (state as u16) << 8
}

/// Zonks, Infotrons and chips: things a Zonk or an Infotron rolls off.
pub fn is_round(word: u16) -> bool {
    word == at_rest(ZONK) || word == at_rest(INFOTRON) || word == at_rest(CHIP)
}

/// Cells a rolling object may slide past at its side.
pub fn is_open_beside(word: u16) -> bool {
    word == 0 || word == RESERVED || word == ROLLED_FROM
}
