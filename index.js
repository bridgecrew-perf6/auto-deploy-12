const path = require("path");
const shell = require("shelljs");
const inquirer = require("inquirer");
// import ora from "ora";
const { Client } = require("ssh2");

class MyClient extends Client {
  constructor(config) {
    super();
    this.config = config;
  }

  // 初始化 建立连接
  initConnection() {
    return new Promise((resolve, reject) => {
      this.on("ready", () => {
        console.log("connect is ready");
        resolve(true);
      })
        .on("error", err => reject(err))
        .on("end", () => {
          console.log("connect end");
        })
        .on("close", () => {
          console.log("connect close");
        })
        .connect(this.config.ssh);
    });
  }

  /**
   * 上传文件到服务器（如果ssh登录用户无`uploadFolder`目录rwx权限，文件默认上传到该用户家目录下）
   */
  uploadFile() {
    return new Promise((resolve, reject) => {
      this.sftp((err, sftp) => {
        if (err) {
          reject(err);
        }

        const { distTar, uploadFolder, localFolder } = this.config;

        const localFile = path.join(localFolder, distTar);
        const remoteFile = path.join(uploadFolder, distTar).replace(/\\/g, "/");

        // const task = ora({ text: `文件上传中 => ${remoteFile}`, color: 'magenta' }).start();

        sftp.fastPut(localFile, remoteFile, {}, err => {
          if (err) {
            reject(err);
          }

          // task.succeed("上传成功");

          resolve(true);
        });
      });
    });
  }

  /**
   * 服务器端shell（备份当前版本，解压并发布新版本）
   */
  execServerShell() {
    return new Promise((resolve, reject) => {
      this.shell((err, stream) => {
        if (err) reject(err);

        const { projectName, remoteFolder, distTar, dist, uploadFolder } = this.config;

        stream
          .on("data", data => {
            console.log(
              "Command: " +
                data
                  .toString()
                  .replace(/^\[.*\]./, "")
                  .trim()
            );
          })
          .on("close", () => {
            console.log("Stream :: close");
            resolve();
          })
          .end(
            `
            sudo su
            mkdir -p ${remoteFolder}
            cd ${remoteFolder}
            mv -n ${distTar} ${dist}$(date +%m%d).tar.gz
            mv -n ${projectName} ${projectName}$(date +%m%d) 
            mv -f ${uploadFolder}/${distTar} ${distTar}
            tar -zxf ${distTar}
            chown -R root:root ${dist} ${distTar}
            rm -rf ${projectName}
            mv -f ${dist} ${projectName}
            exit
            exit
            `
          );
      });
    });
  }
}

/**
 * 打包本地项目，并生成对应的压缩包
 */
const build = config => {
  const { localFolder, buildCommand, distTar } = config;

  return new Promise((resolve, reject) => {
    shell.cd(localFolder); // 进入到项目目录
    // shell.exec(buildCommand) // 打包命令
    console.log("=== 开始压缩 ===");
    shell.exec(`tar -zcf ${distTar} dist`);
    console.log("=== 压缩完成 ===");
    resolve(true);
  });
};

/**
 * 打包部署的入口函数
 */
const main = async config => {
  // distTar => 项目 build 生成的目录压缩后的文件名
  const data = { ...config, distTar: `${config.dist}.tar.gz` };

  if (!data.password) {
    const answers = await inquirer.prompt([
      {
        type: "password",
        name: "password",
        message: "请输入远程服务器ssh密码",
      },
    ]);

    const password = answers.password.trim();
    
    if (!password) {
      throw '请正确输入远程服务器ssh密码！';
    }

    data.password = password;
  }

  await build(data); // 打包

  const conn = new MyClient(data); // 创建连接对象

  try {
    await conn.initConnection(); // 初始化连接
    await conn.uploadFile(); // 上传文件
    await conn.execServerShell();
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    conn.end();
  }
};

export default main;
