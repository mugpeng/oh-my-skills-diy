---
name: peng-remote-sendfile
description: Resumable, integrity-checked transfer of large files to a remote host over ssh. Use when sending or uploading a big file (roughly >1 GB, or anything over a slow/flaky link such as a VPN) to a server, NAS, or cluster with scp/rsync/sftp, when the user mentions resuming an interrupted transfer, re-uploading after a connection drop, or verifying that a transferred file is not corrupted. Triggers include 传大文件、上传到服务器/NAS、断点续传、续传、传输中断、校验传输文件. Do not use for small files (plain scp is fine) or for same-machine copies.
---

# Remote Sendfile

Transfer a large local file to a remote host over ssh with resume and integrity guarantees, using the bundled `sendfile` script.

The script is the source of truth. Do not reimplement chunked transfer logic inline.

## Install

Symlink the script into a directory on PATH once (the repo copy stays canonical):

```bash
ln -sf "$PWD/sendfile" ~/bin/sendfile
```

If the symlink is missing, call the script by its absolute path inside the skill directory.

## Usage

```bash
sendfile [-c CHUNK_MB] [-p PORT] <local_file> <user@host:/remote/path>
```

Example:

```bash
sendfile /Users/peng/Downloads/Data.tar pengyz@10.119.31.159:/volume1/DengLab/0522-WXR_MCF7.tar
```

- `-c CHUNK_MB`: chunk size in MB (default 128). Smaller chunks (e.g. 16) trade a bit of speed for finer-grained resume.
- `-p PORT`: ssh port when the host does not use 22 (e.g. `sendfile -p 8051 big.tar t040734@biotrainee.cn:~/big.tar`).
- The remote parent directory is created if missing.
- Requires passwordless ssh (key auth) to the remote host. If auth fails, ask the user to run `ssh-copy-id` first.

## Guarantees

- **Positioned writes**: every chunk is written at its absolute offset with `dd seek=... conv=notrunc`, never appended. Re-running is always safe, and a stale half-finished writer from a dropped connection can only rewrite the same bytes at the same offsets.
- **Resume**: on start the script reads the remote file size and continues from the first incomplete chunk. Interrupted mid-chunk data is simply overwritten by the full chunk on retry.
- **Integrity**: after the transfer it compares sha1 of both sides. On mismatch it scans chunk-by-chunk and rewrites only the bad chunks, then verifies again. It only exits 0 when both hashes match.
- **Network outages**: empty ssh replies are retried every 30s; they are never mistaken for corruption.

## Operating notes

- Run it with `nohup ... &` for multi-hour transfers and poll the log; the script prints one line per chunk.
- Do not gzip the file first unless the user asks: bio/imaging payloads are usually already compressed, and gzip only adds CPU time.
- Warn the user not to let the machine sleep during the transfer; sleeping pauses it and the timeline slips, but no data is lost.
- The script opens about two ssh connections per chunk. On hosts with connection rate limits or auto-block (e.g. Synology DSM), keep chunks reasonably large (the 128 MB default is fine) and do not run parallel transfers to the same host.
- The remote host needs GNU coreutils (`stat`, `dd`, `sha1sum`, `truncate`); the local side needs `ssh` and `shasum` (macOS) or `sha1sum` (Linux).
- If the final verify fails and the scan reports no bad chunk, the source file is probably changing during the transfer; stop and ask the user.
