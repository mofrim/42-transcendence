import { execFileSync } from 'node:child_process';

try {
    execFileSync(
        'git',
        [
            '-c',
            'safe.directory=*',
            'config',
            '--local',
            'core.hooksPath',
            '.githooks',
        ],
        { stdio: 'ignore' }
    );
} catch {
    // npm can run outside a Git checkout, for example during package installs.
}
