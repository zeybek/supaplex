//! Plays .SP solutions and counts those that finish:
//! `cargo run --release --example corpus -- <folders or files>`.
use supaplex_core::{LEVEL_BYTES, Machine};

fn play(file: &[u8]) -> Result<u32, String> {
    if file.len() <= LEVEL_BYTES + 1 {
        return Err("no keys".into());
    }
    let mut level = [0u8; LEVEL_BYTES];
    level.copy_from_slice(&file[..LEVEL_BYTES]);
    let mut m = Box::new(Machine::new());
    m.start(&level, u16::from_le_bytes([level[1534], level[1535]]));
    let mut frames = 0u32;
    for &b in &file[LEVEL_BYTES + 1..] {
        if b == 0xff {
            break;
        }
        for _ in 0..=(b >> 4) {
            m.frame(b & 0x0f);
            frames += 1;
            if m.completed() {
                return Ok(frames);
            }
        }
    }
    Err(format!(
        "frame {frames}: {} infotrons left, murphy {}{}",
        m.infotrons_left(),
        m.murphy(),
        if m.killed() { " (dead)" } else { "" }
    ))
}

fn files(path: &std::path::Path, out: &mut Vec<std::path::PathBuf>) {
    if let Ok(dir) = std::fs::read_dir(path) {
        let mut entries: Vec<_> = dir.filter_map(|e| e.ok().map(|e| e.path())).collect();
        entries.sort();
        for p in entries {
            files(&p, out);
        }
    } else if path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("sp"))
    {
        out.push(path.to_path_buf());
    }
}

fn main() {
    let mut list = Vec::new();
    for a in std::env::args().skip(1) {
        files(std::path::Path::new(&a), &mut list);
    }
    let (mut ok, mut bad) = (0, 0);
    for f in &list {
        match play(&std::fs::read(f).unwrap()) {
            Ok(_) => ok += 1,
            Err(e) => {
                bad += 1;
                println!("FAIL {} {e}", f.display());
            }
        }
    }
    println!("{ok} of {} finish, {bad} do not", list.len());
}
