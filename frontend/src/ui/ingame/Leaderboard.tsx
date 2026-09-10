import { useId } from 'react';

type LeaderboardEntry = {
    readonly rank: number;
    readonly nickname: string;
    readonly score: number;
    readonly blackHole: string;
};

const EXAMPLE_PLAYER: LeaderboardEntry = {
    rank: 1,
    nickname: 'Player1',
    score: 1500,
    blackHole: '01:37',
};

const EXAMPLE_LEADERBOARD: readonly LeaderboardEntry[] = [
    { rank: 1, nickname: 'Student', score: 42, blackHole: '0:37' },
    { rank: 2, nickname: 'Pisciner', score: 38, blackHole: '0:42' },
    { rank: 3, nickname: 'Player3', score: 35, blackHole: '0:51' },
];

export function Leaderboard() {
    const rankingTitleId = useId();

    return (
        <>
            <section
                className='hud-leaderboard-player'
                aria-label='Eigene Leaderboard-Statistik'
            >
                <h3 className='hud-leaderboard-section-title'>Player Stats</h3>
                <dl className='hud-leaderboard-stats'>
                    <div>
                        <dt>Nickname</dt>
                        <dd>{EXAMPLE_PLAYER.nickname}</dd>
                    </div>
                    <div>
                        <dt>Punktzahl</dt>
                        <dd>{EXAMPLE_PLAYER.score}</dd>
                    </div>
                    <div>
                        <dt>Rang</dt>
                        <dd>{EXAMPLE_PLAYER.rank}</dd>
                    </div>
                    <div>
                        <dt>Blackhole</dt>
                        <dd>{EXAMPLE_PLAYER.blackHole}</dd>
                    </div>
                </dl>
            </section>

            <section aria-labelledby={rankingTitleId}>
                <h3
                    id={rankingTitleId}
                    className='hud-leaderboard-section-title'
                >
                    Top-Spieler
                </h3>
                <table className='hud-leaderboard-table'>
                    <thead>
                        <tr>
                            <th scope='col'>Rang</th>
                            <th scope='col'>Spieler</th>
                            <th scope='col'>Punkte</th>
                            <th scope='col'>Blackhole</th>
                        </tr>
                    </thead>
                    <tbody>
                        {EXAMPLE_LEADERBOARD.map((entry) => (
                            <tr key={entry.rank}>
                                <td>{entry.rank}.</td>
                                <td>{entry.nickname}</td>
                                <td>{entry.score}</td>
                                <td>{entry.blackHole}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </>
    );
}
