use super::*;

const LEVELS: &[u8] = include_bytes!("../../../data/LEVELS.DAT");

/// A level from a picture: the rows go in the top left corner of a field
/// of hardware, so the edge is always a wall.
fn level(rows: &[&str]) -> Box<Game> {
    let mut g = Box::new(Game::new());
    g.level[..N].fill(HARDWARE);
    for (y, row) in rows.iter().enumerate() {
        for (x, ch) in row.chars().enumerate() {
            g.level[(y + 1) * W + x + 1] = match ch {
                ' ' => SPACE,
                '.' => BASE,
                'M' => MURPHY,
                'O' => ZONK,
                '@' => INFOTRON,
                'H' => HARDWARE,
                '#' => RAM,
                'E' => EXIT,
                'o' => ORANGE,
                'S' => SNIK_SNAK,
                'e' => ELECTRON,
                'y' => YELLOW,
                'T' => TERMINAL,
                'r' => RED,
                '>' => PORT_RIGHT,
                '<' => PORT_LEFT,
                'v' => PORT_DOWN,
                '^' => PORT_UP,
                '|' => PORT_VERTICAL,
                '-' => PORT_HORIZONTAL,
                '+' => PORT_CROSS,
                'b' => BUG,
                other => panic!("no piece for {other:?}"),
            };
        }
    }
    g
}

fn at(x: usize, y: usize) -> usize {
    (y + 1) * W + x + 1
}

fn run(g: &mut Game, input: u8, frames: usize) -> u32 {
    let mut events = 0;
    for _ in 0..frames {
        events |= g.step(input);
    }
    events
}

fn load(n: usize) -> Box<Game> {
    let mut g = Box::new(Game::new());
    g.level
        .copy_from_slice(&LEVELS[(n - 1) * LEVEL_BYTES..n * LEVEL_BYTES]);
    g
}

/// A demo's keys, a frame each, as the game plays them back.
fn demo_keys(file: &[u8]) -> Vec<u8> {
    let mut keys = Vec::new();
    for &byte in &file[LEVEL_BYTES + 1..] {
        if byte == 0xff {
            break;
        }
        for _ in 0..=(byte >> 4) {
            keys.push(byte & 0x0f);
        }
    }
    keys
}

fn demo(n: usize) -> Vec<u8> {
    std::fs::read(format!(
        "{}/../../data/DEMO{n}.BIN",
        env!("CARGO_MANIFEST_DIR")
    ))
    .unwrap()
}

/// The game's ten demos against the original, frame for frame: each number
/// is FNV-1a over every frame the original played (its tiles and states,
/// Murphy's cell and the random seed), so one cell or random number out of
/// place on any frame changes it.
#[test]
fn the_original_demos_frame_for_frame() {
    const ORIGINAL: [(usize, u64); 10] = [
        (819, 0x5c33_7c95_896f_e6a3),
        (89, 0x433d_2b01_97e7_3087),
        (203, 0xe4da_6076_3c05_2664),
        (222, 0x84bf_1b15_ffc7_8a60),
        (136, 0x2e6a_da31_a146_75ea),
        (5787, 0x0c26_cc59_f05c_4c2f),
        (4424, 0xe534_8d34_b13e_7799),
        (5987, 0xdad7_2012_4bf9_72fb),
        (5222, 0x646a_05b1_24af_cfae),
        (353, 0x2d59_1a70_1c21_20f9),
    ];
    for (n, &(frames, expected)) in ORIGINAL.iter().enumerate() {
        let file = demo(n);
        let mut level = [0u8; LEVEL_BYTES];
        level.copy_from_slice(&file[..LEVEL_BYTES]);
        let keys = demo_keys(&file);
        let mut c = Box::new(Machine::new());
        c.start(&level, u16::from_le_bytes([level[1534], level[1535]]));
        let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
        let mut eat = |b: u8| {
            hash ^= b as u64;
            hash = hash.wrapping_mul(0x0100_0000_01b3);
        };
        for f in 0..frames {
            c.frame(keys.get(f).copied().unwrap_or(0));
            for i in 0..N as i32 {
                eat(c.tile(i));
                eat(c.state(i));
            }
            for b in (c.murphy() as u16)
                .to_le_bytes()
                .into_iter()
                .chain(c.seed().to_le_bytes())
            {
                eat(b);
            }
        }
        assert_eq!(hash, expected, "DEMO{n} parts from the original");
    }
}

/// Demos 5 and 7 (EASY DEAL, GO THROUGH!) are whole solutions.
#[test]
fn the_demos_that_solve_their_level_win() {
    for n in [5, 7] {
        let file = demo(n);
        let mut g = Box::new(Game::new());
        g.level.copy_from_slice(&file[..LEVEL_BYTES]);
        g.start(u16::from_le_bytes([file[1534], file[1535]]) as u32);
        let mut won = 0;
        for key in demo_keys(&file) {
            won |= g.step(key) & EV_WIN;
            if g.status != PLAYING {
                break;
            }
        }
        assert_ne!(won, 0, "DEMO{n} wins");
        assert_eq!(g.status, WON);
        assert_eq!(g.machine.infotrons_left(), 0);
    }
}

#[test]
fn all_111_levels_start_with_a_murphy() {
    assert_eq!(LEVELS.len(), 111 * LEVEL_BYTES);
    for n in 1..=111 {
        let mut g = load(n);
        assert!(g.start(1), "level {n} has a Murphy");
        assert_eq!(g.kind[g.murphy], MURPHY);
    }
    let mut g = level(&[" "]);
    assert!(!g.start(1), "no Murphy, no game");
}

#[test]
fn the_first_level_reads_as_the_game_shows_it() {
    let mut g = load(1);
    g.start(1);
    assert_eq!(&g.level[1446..1469], b"------- WARM UP -------");
    assert_eq!(g.machine.infotrons_needed(), 19);
    assert!(!g.machine.gravity());
    // Level 21, GRAVITY, starts with it on.
    let mut g = load(21);
    g.start(1);
    assert!(g.machine.gravity());
}

#[test]
fn a_zonk_settles_then_falls_eight_frames_a_cell() {
    let mut g = level(&["O", " ", " ", ".", "", "M"]);
    g.start(1);
    g.step(0);
    assert_eq!(g.phase[at(0, 0)], SETTLING);
    g.step(0);
    // It has the cell below, and is drawn coming down into it.
    assert_eq!(g.kind[at(0, 1)], ZONK);
    assert_ne!(g.flags[at(0, 1)] & F_MOVING, 0);
    assert_eq!((g.dir[at(0, 1)], g.phase[at(0, 1)]), (DOWN, FALLING));
    run(&mut g, 0, 9);
    assert_eq!(g.kind[at(0, 2)], ZONK);
    // Still falling, it goes straight on into the next cell.
    assert_ne!(g.flags[at(0, 2)] & F_MOVING, 0);
    run(&mut g, 0, 40);
    assert_eq!(g.kind[at(0, 2)], ZONK, "base holds it");
    assert_eq!(g.flags[at(0, 2)] & F_MOVING, 0);
    assert_eq!(g.status, PLAYING);
}

#[test]
fn a_falling_zonk_kills_murphy() {
    let mut g = level(&["O", " ", "M"]);
    g.start(1);
    let events = run(&mut g, 0, 30);
    assert_ne!(events & EV_DEATH, 0);
    assert_eq!(g.status, DYING_STATUS);
    assert_eq!(g.action, GONE);
    assert_eq!(g.machine.death().0, CAUSE_CRUSHED);
    assert_eq!(g.machine.death().1, at(0, 2) as i32);
    run(&mut g, 0, 100);
    assert_eq!(g.status, DEAD);
    let tick = g.tick;
    assert_eq!(g.step(0), 0, "a level that is over stays over");
    assert_eq!(g.tick, tick);
}

#[test]
fn a_resting_zonk_does_not_kill_murphy_walking_under_it() {
    let mut g = level(&["HOH", "M H", "HHH"]);
    g.start(1);
    run(&mut g, 4, 8);
    assert_eq!(g.murphy, at(1, 1));
    run(&mut g, 0, 30);
    assert_eq!(g.status, PLAYING, "the Zonk sat on hardware");
}

#[test]
fn zonks_roll_off_zonks() {
    let mut g = level(&[" O ", " O ", "HHH", "", "M"]);
    g.start(1);
    g.step(0);
    assert_eq!(g.phase[at(1, 0)], TIPPING);
    run(&mut g, 0, 30);
    let rolled = g.kind[at(0, 1)] == ZONK || g.kind[at(2, 1)] == ZONK;
    assert!(rolled, "the top Zonk rolled down a side");
    assert_eq!(g.kind[at(1, 0)], SPACE);
}

#[test]
fn murphy_walks_eats_collects_and_leaves() {
    let mut g = level(&["M.@E"]);
    g.start(1);
    let events = g.step(4);
    assert_ne!(events & EV_EAT, 0);
    // Drawn arriving in the cell he is going to.
    assert_eq!((g.murphy, g.action, g.murphy_dir), (at(1, 0), WALK, RIGHT));
    assert_eq!(g.kind[at(0, 0)], RESERVED);
    assert_eq!(g.action_len, 8);
    let mut events = run(&mut g, 4, 7);
    assert_eq!(g.action, IDLE);
    events |= run(&mut g, 4, 8);
    assert_ne!(events & EV_INFOTRON, 0);
    assert_ne!(events & EV_EXIT_OPEN, 0);
    assert_eq!(g.machine.infotrons_left(), 0);
    let events = g.step(4);
    assert_ne!(events & EV_WIN, 0, "the level is won on reaching the exit");
    assert_eq!((g.status, g.action), (WON, LEAVING));
    run(&mut g, 0, 40);
    assert_eq!(g.action, GONE);
    run(&mut g, 0, 30);
    assert!(g.over());
}

#[test]
fn the_exit_stays_shut_until_enough_infotrons() {
    let mut g = level(&["@ME"]);
    g.start(1);
    let events = run(&mut g, 4, 20);
    assert_eq!(events & EV_WIN, 0);
    assert_eq!(g.status, PLAYING);
}

#[test]
fn murphy_leans_on_a_zonk_before_it_moves() {
    let mut g = level(&["MO "]);
    g.start(1);
    let events = g.step(4);
    assert_ne!(events & EV_PUSH, 0);
    assert_eq!((g.action, g.murphy), (LEANING, at(0, 0)));
    run(&mut g, 4, 8);
    // Pushing: he and the Zonk are drawn arriving a cell on.
    assert_eq!((g.action, g.murphy), (PUSHING, at(1, 0)));
    assert_eq!(g.kind[at(2, 0)], ZONK);
    assert_eq!((g.dir[at(2, 0)], g.phase[at(2, 0)]), (RIGHT, SHOVED));
    assert_eq!(g.kind[at(0, 0)], VACATING);
    run(&mut g, 4, 8);
    assert_eq!(g.kind[at(2, 0)], ZONK);
    assert_eq!(g.kind[at(1, 0)], MURPHY);
    assert_eq!(g.machine.murphy(), at(1, 0) as i32);

    // Letting go in time leaves it where it was.
    let mut g = level(&["MO "]);
    g.start(1);
    run(&mut g, 4, 3);
    run(&mut g, 0, 10);
    assert_eq!(g.kind[at(1, 0)], ZONK);
    assert_eq!(g.action, IDLE);
}

#[test]
fn a_zonk_cannot_be_pushed_up() {
    let mut g = level(&[" ", "O", "M"]);
    g.start(1);
    run(&mut g, 1, 30);
    assert_eq!(g.kind[at(0, 1)], ZONK);
    assert_eq!(g.murphy, at(0, 2));
}

#[test]
fn a_snik_snak_turns_on_the_spot_then_goes() {
    let mut g = level(&["   ", " H ", "S  ", "", "M"]);
    g.start(1);
    // Walled on its left, free above: it starts out going up.
    assert_eq!(g.kind[at(0, 1)], SNIK_SNAK);
    assert_eq!((g.flags[at(0, 1)], g.dir[at(0, 1)]), (F_MOVING, 0));
    let mut turned = false;
    let mut seen = std::collections::HashSet::new();
    let mut moved = false;
    for _ in 0..400 {
        g.step(0);
        for c in 0..N {
            if g.kind[c] == SNIK_SNAK {
                seen.insert(c);
                moved |= g.flags[c] & F_MOVING != 0;
                turned |= g.flags[c] & F_TURNING != 0;
            }
        }
    }
    assert!(moved && turned);
    assert!(
        seen.len() >= 6,
        "it went round the ring, saw {}",
        seen.len()
    );
}

#[test]
fn a_snik_snak_touching_murphy_kills_him() {
    let mut g = level(&["S M"]);
    g.start(1);
    let events = run(&mut g, 0, 200);
    assert_ne!(events & EV_DEATH, 0);
    assert_eq!(g.machine.death().0, CAUSE_ENEMY);
}

#[test]
fn an_electron_blows_up_into_infotrons() {
    // Walled in, it stays put; the orange disk lands beside it.
    let mut g = level(&["o  ", " H ", "HeH", "", "M"]);
    g.start(1);
    let mut electric = false;
    for _ in 0..80 {
        g.step(0);
        electric |= (0..N).any(|c| g.kind[c] == EXPLOSION && g.flags[c] & F_ELECTRON != 0);
    }
    assert!(electric);
    let infotrons = (0..N).filter(|&c| g.kind[c] == INFOTRON).count();
    assert!(infotrons >= 3, "the blast left Infotrons, {infotrons}");
}

#[test]
fn an_orange_disk_falls_and_goes_off_when_it_lands() {
    let mut g = level(&["o", " ", " ", "H", "", "M"]);
    g.start(1);
    let mut drawn_falling = false;
    let mut events = 0;
    for _ in 0..40 {
        events |= g.step(0);
        drawn_falling |= g.kind[at(0, 1)] == ORANGE && g.flags[at(0, 1)] & F_MOVING != 0;
    }
    assert!(drawn_falling, "drawn coming down into the cell below");
    assert_ne!(events & EV_EXPLOSION, 0);
    assert_eq!(g.status, PLAYING);
}

#[test]
fn explosions_burn_out_and_set_off_disks_next_to_them() {
    let mut g = level(&["o ", "  ", " r", "H ", "", "  M"]);
    g.start(1);
    let mut longest = 0;
    let mut events = 0;
    for _ in 0..120 {
        events |= g.step(0);
        for c in 0..N {
            if g.kind[c] == EXPLOSION {
                longest = longest.max(g.timer[c]);
            }
        }
    }
    assert_ne!(events & EV_EXPLOSION, 0);
    assert!(longest > 0 && longest <= 32);
    assert_ne!(g.kind[at(1, 2)], RED, "the red disk went off too");
    assert!((0..N).all(|c| g.kind[c] != EXPLOSION), "all burnt out");
}

#[test]
fn gravity_pulls_murphy_down() {
    let mut g = level(&["M", " ", " ", "H"]);
    g.start(1);
    g.machine.set_gravity(true);
    run(&mut g, 0, 17);
    assert_eq!(g.machine.murphy(), at(0, 2) as i32);
}

#[test]
fn ports_only_let_murphy_through_one_way() {
    let mut g = level(&["M> "]);
    g.start(1);
    let events = g.step(4);
    assert_ne!(events & EV_PORT, 0);
    assert_eq!((g.action, g.murphy), (THROUGH_PORT, at(2, 0)));
    run(&mut g, 4, 8);
    assert_eq!(g.machine.murphy(), at(2, 0) as i32);
    run(&mut g, 2, 40);
    assert_eq!(
        g.machine.murphy(),
        at(2, 0) as i32,
        "not back the wrong way"
    );
}

#[test]
fn a_dropped_red_disk_goes_off_after_its_fuse() {
    let mut g = level(&["Mr    "]);
    g.start(1);
    let events = run(&mut g, 4, 9);
    assert_ne!(events & EV_RED_PICKED, 0);
    assert_eq!(g.machine.red_disks(), 1);
    run(&mut g, 0, 1);
    let mut events = 0;
    // Space held: he sets it down after 64 frames.
    for _ in 0..80 {
        events |= g.step(9);
        if g.planted().is_some() {
            break;
        }
    }
    assert_ne!(events & EV_RED_DROPPED, 0);
    assert_eq!(g.planted().map(|(c, _)| c), Some(at(1, 0)));
    // Walk away, far enough, and it goes off on its own.
    run(&mut g, 4, 24);
    assert_eq!(g.kind[at(1, 0)], RED_LIT);
    let events = run(&mut g, 0, 40);
    assert_ne!(events & EV_EXPLOSION, 0);
    assert_eq!(g.planted(), None);
    assert_eq!(g.status, PLAYING);
}

#[test]
fn a_terminal_blows_every_yellow_disk() {
    let mut g = level(&["MT y", "    ", "   y"]);
    g.start(1);
    let events = run(&mut g, 4, 3);
    assert_ne!(events & EV_TERMINAL, 0);
    run(&mut g, 0, 3);
    assert!((0..N).all(|c| g.kind[c] != YELLOW));
}

#[test]
fn eating_a_sparking_bug_kills_murphy() {
    let mut g = level(&["Mb"]);
    g.start(1);
    assert_ne!(g.flags[at(1, 0)] & F_ACTIVE, 0, "bugs start sparking");
    let events = g.step(4);
    assert_ne!(events & EV_EXPLOSION, 0);
    run(&mut g, 0, 2);
    assert_eq!(g.machine.death().0, CAUSE_BUG);
}

#[test]
fn same_seed_same_game() {
    let play = |seed| {
        let mut g = load(9);
        g.start(seed);
        let mut trace = 0u64;
        for t in 0..2000u64 {
            g.step(((t / 40) % 5) as u8);
            trace = trace
                .wrapping_mul(31)
                .wrapping_add(g.kind.iter().map(|&k| k as u64).sum::<u64>());
        }
        trace
    };
    assert_eq!(play(7), play(7));
}

#[path = "../../core/src/tests/random.rs"]
mod random;

/// Everything the page reads after a frame, folded into one number; the
/// arrays only on every 64th frame, to keep the test quick.
fn fold(hash: &mut u64, g: &Game, frame: usize) {
    let mut add = |value: u64| {
        *hash ^= value;
        *hash = hash.wrapping_mul(0x100_0000_01b3);
    };
    if frame.is_multiple_of(64) {
        for c in 0..N {
            add(u64::from(g.kind[c]) | u64::from(g.look[c]) << 8 | u64::from(g.dir[c]) << 16);
            add(u64::from(g.prog[c]) | u64::from(g.flags[c]) << 8 | u64::from(g.phase[c]) << 16);
            add(u64::from(g.timer[c]));
        }
    }
    for value in [
        u64::from(g.tick),
        u64::from(g.status),
        g.murphy as u64,
        u64::from(g.murphy_dir),
        u64::from(g.action),
        u64::from(g.action_tick),
        u64::from(g.action_len),
        g.planted()
            .map_or(0, |(c, fuse)| (c as u64) << 8 | u64::from(fuse)),
        u64::from(g.over()),
    ] {
        add(value);
    }
}

/// Every level, then random ones, played on random keys, as the page reads them.
fn play_everything(seed: u32) -> u64 {
    let mut hash = 0xcbf2_9ce4_8422_2325;
    let mut keys = random::Keys::new(seed);
    for n in 1..=111 {
        let mut g = load(n);
        g.start(seed ^ n as u32);
        for frame in 0..1500 {
            g.step(keys.next());
            fold(&mut hash, &g, frame);
            if g.over() {
                g.start(keys.next().into());
            }
        }
    }
    for _ in 0..300 {
        let mut g = Box::new(Game::new());
        g.level = random::random_level(&mut keys);
        g.start(keys.next().into());
        for frame in 0..500 {
            g.step(keys.next());
            fold(&mut hash, &g, frame);
        }
    }
    hash
}

#[test]
fn random_play_reads_the_same_twice() {
    assert_eq!(play_everything(0xbeef), play_everything(0xbeef));
}

/// The module's exports, as the page calls them, on the one game they share.
/// All in one test: tests run in parallel and would share that game.
#[test]
fn the_exports_play_a_level() {
    let level = &LEVELS[..LEVEL_BYTES];
    // SAFETY: the buffer is the game's level array, LEVEL_BYTES long.
    unsafe { core::ptr::copy_nonoverlapping(level.as_ptr(), level_buffer(), LEVEL_BYTES) };
    assert_eq!(start(1), 1);
    let murphy = stat(8) as usize;
    // SAFETY: each pointer is to one of the game's N-long arrays.
    let read = |at: *const u8| unsafe { *at.add(murphy) };
    assert_eq!(read(kinds()), MURPHY);
    assert_eq!(read(looks()), MURPHY);
    assert_eq!(read(dirs()), 0);
    assert_eq!(read(progs()), 0);
    assert_eq!(read(cell_flags()), 0);
    assert_eq!(read(phases()), AT_REST);
    // SAFETY: as above, for the timers.
    assert_eq!(unsafe { *timers().add(murphy) }, 0);
    assert_eq!(step(0), 0);
    let stats: Vec<i32> = (0..=17).map(|n| stat(n)).collect();
    assert_eq!(stats[0], 1, "one tick");
    assert_eq!(stats[1], PLAYING as i32);
    assert_eq!(stats[2], 19, "Infotrons needed");
    assert_eq!(stats[3], 19, "left");
    assert_eq!(stats[8], murphy as i32);
    assert_eq!(stats[13], -1, "no disk planted");
    assert_eq!(stats[15], CAUSE_NONE as i32);
    assert_eq!(stats[17], -1, "no such stat");

    // A save state: the bytes at `state`, written back, play on the same.
    let saved: Vec<u8> =
        unsafe { core::slice::from_raw_parts(state(), state_len() as usize) }.to_vec();
    assert_eq!(saved.len(), core::mem::size_of::<Game>());
    for _ in 0..40 {
        step(4);
    }
    let after = (stat(0), stat(8));
    unsafe { core::ptr::copy_nonoverlapping(saved.as_ptr(), state(), saved.len()) };
    assert_eq!(stat(0), 1, "back to the saved tick");
    for _ in 0..40 {
        step(4);
    }
    assert_eq!((stat(0), stat(8)), after);

    // `run`: keys from the buffer, a frame each, stopping when the game ends.
    assert_eq!(keys_len() as usize, KEY_BUFFER);
    unsafe { core::ptr::write_bytes(keys_buffer(), 4, 10) };
    let tick = stat(0);
    assert_eq!(crate::run(10), 10);
    assert_eq!(stat(0), tick + 10);
    assert_eq!(
        crate::run(keys_len() + 1),
        keys_len(),
        "never past the buffer"
    );

    // `stat` while a red disk is set down: its cell and fuse. Tests run on
    // threads, and the exports share one game, so this goes here.
    let g = game();
    g.level[..N].fill(HARDWARE);
    g.level[at(0, 0)] = MURPHY;
    g.level[at(1, 0)] = RED;
    g.level[at(2, 0)] = SPACE;
    assert_eq!(start(1), 1);
    for _ in 0..9 {
        step(4);
    }
    step(0);
    while stat(13) < 0 {
        step(9);
    }
    assert_eq!(stat(13), at(1, 0) as i32);
    assert!(stat(14) > 0);

    // He stays on it: once the game is no longer being played, `run` plays nothing.
    while stat(1) == PLAYING as i32 {
        step(0);
    }
    assert_eq!(crate::run(5), 0);
}

#[test]
fn a_game_by_default_is_a_new_one() {
    let g = Box::<Game>::default();
    assert_eq!(g.status, PLAYING);
    assert_eq!(g.tick, 0);
}

#[test]
fn murphy_walking_off_a_level_without_walls_breaks_nothing() {
    let mut g = Box::new(Game::new());
    // Murphy on the top row, open to the memory above the field.
    g.level[..N].fill(SPACE);
    g.level[5] = MURPHY;
    assert!(g.start(1));
    run(&mut g, 1, 200);
    assert!(g.murphy < N);
    assert!(g.machine.murphy() < 0, "he is above the field");
}

#[test]
fn yellow_disks_go_up_and_down_too() {
    let mut g = level(&[" ", "y", "M"]);
    g.start(1);
    let events = run(&mut g, 1, 30);
    assert_ne!(events & EV_PUSH, 0);
    assert_eq!(g.kind[at(0, 0)], YELLOW);
    assert_eq!(g.machine.murphy(), at(0, 1) as i32);

    let mut g = level(&["M", "y", " "]);
    g.start(1);
    run(&mut g, 3, 30);
    assert_eq!(g.kind[at(0, 2)], YELLOW);
    assert_eq!(g.machine.murphy(), at(0, 1) as i32);
}

#[test]
fn an_orange_disk_goes_left_and_falls_when_pushed_over_a_hole() {
    let mut g = level(&[" oM"]);
    g.start(1);
    run(&mut g, 2, 30);
    assert_eq!(g.kind[at(0, 0)], ORANGE);
    assert_eq!(g.machine.murphy(), at(1, 0) as i32);

    let mut g = level(&["Mo  ", "H H ", "H   "]);
    g.start(1);
    let mut fell = false;
    for _ in 0..40 {
        g.step(4);
        fell |= g.phase.contains(&FALLING);
    }
    assert!(fell, "pushed over the hole, it falls at once");
}

#[test]
fn an_orange_disk_pushed_right_needs_something_under_it() {
    // Frozen Zonks: the level setting keeps nothing from falling here, but
    // an orange disk over a hole is pushed only from the left.
    let mut g = level(&["Mo ", "H  "]);
    g.start(1);
    let events = run(&mut g, 4, 20);
    assert_eq!(events & EV_PUSH, 0);
}

#[test]
fn a_frozen_zonk_with_nothing_under_it_cannot_be_pushed_right() {
    let mut g = level(&["MO ", "H  "]);
    g.level[1469] = 2;
    g.start(1);
    let events = run(&mut g, 4, 20);
    assert_eq!(events & EV_PUSH, 0);
    assert_eq!(g.kind[at(1, 0)], ZONK);
}

#[test]
fn a_special_port_sets_gravity_as_its_table_says() {
    let mut g = level(&["M  "]);
    let port = at(1, 0);
    g.level[port] = SPECIAL_RIGHT;
    g.level[1471] = 1;
    g.level[1472..1474].copy_from_slice(&((port * 2) as u16).to_be_bytes());
    g.level[1474] = 1; // gravity
    g.level[1475] = 2; // frozen Zonks
    g.level[1476] = 1; // frozen enemies
    g.start(1);
    let events = run(&mut g, 4, 20);
    assert_ne!(events & EV_PORT, 0);
    assert_ne!(events & EV_GRAVITY, 0);
    assert!(g.machine.gravity() && g.machine.zonks_frozen() && g.machine.enemies_frozen());
    assert_eq!(g.machine.murphy(), at(2, 0) as i32);
}

#[test]
fn a_zonk_landing_on_murphy_while_he_pushes_sideways_spares_him() {
    let mut g = level(&["O  ", "   ", "MO ", "HHH"]);
    g.start(1);
    run(&mut g, 4, 10);
    // The Zonk has come to rest on top of him, mid-push.
    assert_eq!(g.action, PUSHING);
    assert_eq!((g.kind[at(0, 1)], g.phase[at(0, 1)]), (ZONK, AT_REST));
    run(&mut g, 4, 10);
    assert_eq!(g.status, PLAYING);
    assert_eq!(g.machine.death().0, CAUSE_NONE);
}

#[test]
fn a_zonk_pushed_onto_a_passing_snik_snak_blows_it_up() {
    // The Snik Snak follows the floor under where the Zonk is going; the
    // push ends as it passes, and the blast takes Murphy too.
    let mut g = level(&["MO HHH", "HH   S", "HHHHHH"]);
    g.start(1);
    run(&mut g, 0, 5);
    let mut events = 0;
    while events & EV_EXPLOSION == 0 {
        events = g.step(4);
    }
    assert_eq!(g.machine.murphy(), at(1, 0) as i32, "the push is done");
    run(&mut g, 0, 20);
    assert!((0..N).all(|c| g.kind[c] != SNIK_SNAK));
    assert_eq!(g.machine.death(), (CAUSE_BLAST, at(1, 0) as i32));
}
#[test]
fn a_snik_snak_spares_murphy_while_he_is_in_a_port() {
    // The Snik Snak turns to face down at frame 16: Murphy, there, dies.
    let mut g = level(&["SHH", "M> "]);
    g.start(1);
    run(&mut g, 0, 20);
    assert_eq!(g.machine.death().0, CAUSE_ENEMY);
    // Into the port at frame 15, he is spared, and comes out the far side.
    let mut g = level(&["SHH", "M> "]);
    g.start(1);
    run(&mut g, 0, 15);
    run(&mut g, 4, 12);
    assert_eq!(g.status, PLAYING);
    assert_eq!(g.machine.murphy(), at(2, 1) as i32);
}

#[test]
fn murphy_cannot_take_back_the_red_disk_he_set_down() {
    let mut g = level(&["Mr  "]);
    g.start(1);
    run(&mut g, 4, 9);
    run(&mut g, 0, 1);
    while g.planted().is_none() {
        g.step(9);
    }
    let disk = at(1, 0);
    run(&mut g, 4, 9);
    // Back onto it: he walks in, but it stays lit and he carries none.
    let events = run(&mut g, 2, 9);
    assert_eq!(events & EV_RED_PICKED, 0);
    assert_eq!(g.machine.red_disks(), 0);
    assert_eq!(g.planted().map(|(c, _)| c), Some(disk));
}

#[test]
fn infotrons_past_the_ones_needed_still_count_as_collected() {
    let mut g = level(&["M@@E"]);
    g.level[1470] = 1;
    g.start(1);
    let events = run(&mut g, 4, 40);
    assert_ne!(events & EV_EXIT_OPEN, 0);
    assert_eq!(g.machine.infotrons_left(), 0);
    assert_eq!(g.status, WON);
}

#[test]
fn drawing_a_cell_off_the_field_is_ignored() {
    let mut g = level(&["M"]);
    g.start(1);
    let before = g.kind;
    g.put(N, ZONK, 0, 0, 0, AT_REST);
    assert_eq!(g.kind, before);
}
