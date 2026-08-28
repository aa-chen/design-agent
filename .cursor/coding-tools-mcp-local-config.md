# coding-tools-mcp 本地配置备忘

`remote-coding-tools-mcp` 的 `init` 只从模板生成 `config.env`，里面的 `WORKSPACE` 和
`CONDA_ENV_PREFIX` 仍是占位符，必须手工改成本机真实值。这里记录两个平台各自该填什么。

> 本文件不含任何 token。token 只放在 `~/.config/coding-tools-mcp/token`
> （Windows 即 `C:\Users\<用户名>\.config\coding-tools-mcp\token`），
> 不要写进 `config.env`，也不要提交进任何仓库。

## 配置文件位置

| 平台 | 路径 |
| --- | --- |
| Windows | `C:\Users\yqw19\.config\coding-tools-mcp\config.env` |
| Linux / WSL | `~/.config/coding-tools-mcp/config.env` |

## 要改的两行

### Windows

```dotenv
WORKSPACE=D:/work/drawing-2d
CONDA_ENV_PREFIX=<本机 Python>=3.11 的 conda 环境前缀>
```

路径一律用正斜杠 `/`，不要用反斜杠。

### Cursor Cloud VM（本仓库 github.com/aa-chen/design-agent）

这两个值已在云端 VM 上实际写入并验证通过：

```dotenv
WORKSPACE=/workspace
CONDA_ENV_PREFIX=/home/ubuntu/miniconda3/envs/coding-tools
```

云端环境是临时的，每次新建 Cloud Agent 都要重做一遍；上面的前缀只在那台 VM 内有效，
不要照抄到 Windows。

## Windows 上怎么拿到 CONDA_ENV_PREFIX

本机目前没检测到 conda，所以要先装一个，再建环境，最后把环境前缀抄进配置。

1. 装 Miniconda：下载 <https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe>
   并安装（用户级安装即可，不需要管理员权限，默认装到
   `C:\Users\yqw19\miniconda3`）。
2. 打开 “Anaconda Prompt”，建一个 Python 3.11 环境：

   ```bat
   conda create -y -n coding-tools python=3.11
   ```

3. 取出这个环境的绝对前缀，二选一：

   ```bat
   conda env list
   ```

   输出里 `coding-tools` 那一行右边就是前缀；或者激活后直接问 Python：

   ```bat
   conda activate coding-tools
   python -c "import sys; print(sys.prefix)"
   ```

4. 顺手确认版本达标（要求 ≥ 3.11，命令没有报错就说明达标）：

   ```bat
   python -c "import sys; assert sys.version_info >= (3, 11); print(sys.version)"
   ```

5. 把第 3 步拿到的路径反斜杠换成正斜杠再填进 `config.env`，通常长这样：

   ```dotenv
   CONDA_ENV_PREFIX=C:/Users/yqw19/miniconda3/envs/coding-tools
   ```

## 填好之后跑 restore

`scripts/restore.sh` 是 Linux shell 脚本，在 Git Bash、WSL 或 Linux 开发机里执行：

```bash
cd ~/.cursor/skills/remote-coding-tools-mcp
scripts/restore.sh up
scripts/restore.sh link-cursor
```

## 云端 VM 上没能跑 restore 的原因

`remote-coding-tools-mcp` 这个 skill 在云端 VM 上装不上，所以 `restore.sh` 两条命令都没执行：

- skill 来自内网 GitLab 的 `do-skills` 仓库。`git.designorder.cn` 从云端 VM 网络上可达
  （443 与 SSH 38922 都通），但仓库是私有的：匿名 HTTPS 一律 401，
  匿名 API 查不到该项目，SSH 没有可用公钥（`Permission denied (publickey)`）。
  已顺带确认几个公开的 skill 仓库（`public_project/tools`、`jian.wu/do_agent_skill`、
  `yuechen.li/skill`、`huiyu.han/dofeatrec_skill`）里都没有 `remote-coding-tools-mcp`。
- 即便拿到 skill，`restore.sh up` 在这类 VM 上也走不通：它依赖 systemd 用户级服务，
  而云端 VM 的 `systemctl --user` 是 `offline`；`cloudflared` 也没有安装，
  隧道那步还需要交互式登录或预置凭据。

要在云端复现完整链路，需要给 VM 提供一个能读 `do-skills` 的只读凭据
（GitLab deploy token 或部署公钥），并解决 systemd / cloudflared 两个依赖。
