import main from "./index";

// demo start
const config = {
  // ssh登录相关配置
  ssh: {
    host: "10.37.148.170",
    port: 22,
    username: "appadmin",
    password: "", // 如果为空，需要用户手动在命令行中输入
  },

  projectName: "platform_yinuojr", // 项目名
  localFolder: "D:\\project\\bunuo-scf-webview", // 项目目录
  buildCommand: "npm run test", // 打包命令
  dist: "dist", // 项目打包后生成的目录名

  uploadFolder: "/home/appadmin", // 压缩包上传的目录
  remoteFolder: `/bubidata/server/nginx/html`, // html根目录，解压后的项目存放的位置
};

main(config);
