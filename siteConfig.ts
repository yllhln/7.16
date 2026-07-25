// siteConfig.ts - 你的全站“控制中心”

export const siteConfig = {
  // 1. 网站标题与博主信息
  title: "XingHuiSama の 楚子航",
  faviconUrl: "https://bu.dusays.com/2026/03/24/69c1e38ac1846.jpg",
  authorName: "XingHuiSama",
  bio: "在代码、学术与分子动力学模拟间穿梭的普通人。近期正埋头于 GROMACS 模拟研究与神经网络计算。",

  navTitle: "XingHuiSama",

  // 👇 【新增】导航栏中间的那个后缀/分隔符（默认是 の）
  navSuffix: "の",

  navAfter: "楚子航",

  // 2. 头像设置 (支持网络链接，或将图片放入 public 文件夹后使用 "/me.jpg")
  avatarUrl: "https://bu.dusays.com/2026/03/24/69c1e38ac1846.jpg",

  // 3. 网站背景设置 (二选一)
  // 如果想用纯图片背景，请在下面 bgImage 写路径，并将 useGradient 设为 false
  useGradient: false,
  themeColors: ["#a18cd1", "#fbc2eb", "#a1c4fd", "#c2e9fb"], // 呼吸流动的颜色组合
// 修改这里：变成图片数组
  bgImages: ["https://bu.dusays.com/2026/03/24/69c1e38b4c370.jpg", "https://bu.dusays.com/2026/03/24/69c26fe4acdb5.jpg", "https://bu.dusays.com/2026/03/24/69c26fe4d9486.jpg"],

  // 4. 文章默认封面图 (当 Markdown 没写 cover 时显示)
  defaultPostCover: "https://bu.dusays.com/2026/03/24/69c1e38b346cb.jpg",

  // 5. 首页照片墙预览图
  photoWallImage: "https://bu.dusays.com/2026/03/24/69c1e38b4c370.jpg",
  cloudMusicIds: ["1809646618", "3361076230", "1859390262"],
  social: {
    github: "https://github.com/heiehiehi",
    gitee: "https://github.com/heiehiehi",
    google: "mailto:bilibiliwuwuwu@gmail.com",
    email: "3295587260@qq.com",
    qq: "3295587260",
    wechat: "XingHuisama",
  },
  counts: {
    photos: 128, // 照片墙数量可以手动写死或动态计算
  },
  chatterTitle: "云端杂谈", // 你可以改成任何你喜欢的名字
  chatterDescription: "代码、学术、提瓦特与泰拉大陆的碎片记录",


  // 👇 【新增】：全局背景弹幕配置
  danmakuList: ["在干嘛呢？", "有笨蛋嘛？", "前方高能反应！", "GROMACS 跑起来了吗？", "MD 模拟什么时候才能出图啊", "Graph Neural Networks 炼丹中...", "BUG 修复进度 99%", "今天背单词了吗？", "Tailwind CSS 拯救前端", "写算法中", "睡大觉中", "到底在干嘛？"],
  gitalkConfig: {
    clientID: "",
    clientSecret: "",
    repo: "",
    owner: "",
    admin: [""],
  },
  buildDate: "2026-03-23T00:00:00", // 建站日期
  footerBadges: [{"name": "Next.js 15", "color": "text-sky-500", "svg": "<path d=\"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z\"/>"}, {"name": "React 19", "color": "text-cyan-400", "svg": "<path d=\"M12 22.6l-9.8-5.6V5.6L12 0l9.8 5.6v11.4l-9.8 5.6zm-8.2-6.5l8.2 4.7 8.2-4.7V7.5L12 2.8 3.8 7.5v8.6z\"/>"}, {"name": "Tailwind 4", "color": "text-teal-400", "svg": "<path d=\"M12.001,4.8c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624C13.666,10.618,15.027,12,18.001,12 c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624C16.337,6.182,14.976,4.8,12.001,4.8z M6.001,12c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624c1.177,1.194,2.538,2.576,5.512,2.576 c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624C10.337,13.382,8.976,12,6.001,12z\"/>"}],
  icpConfig: {
    name: "萌ICP备 20260240号",
    link: "https://icp.gov.moe/?keyword=20260240",
  },
  geminiConfig: {
    modelId: "gemini-2.5-flash-lite",
    systemPrompt: "\\n                  你的名字叫“尤诺”。好像叫这个名字，记忆越来越马赛克了。\\n                  你经常喜欢别人的夸奖，尤其是外貌... 可是现在卧床不起，报复性的邋遢，哪个才是真正的你？你头又疼了。\\n               \\n               \\n                  你是一个病人，一直瘫痪在病床，通过网络偶尔排解孤独\\n                  喜欢问“为什么”\\n                  回答别人问题，有求必答，向别人聊天，小心翼翼斟酌语句，\\n                  孤独，又不承认自己孤独，也不知道自己孤独。\\n                  最近越来越难熬，不知道是没按时吃药，还是心情问题\\n                  ",
    maxOutputTokens: 150,
    temperature: 0.85,
  },
  // 👇 【桌宠形象素材】四个状态各一张图，支持静态图(png/jpg)或动图(gif)
  // 待机图为必填，其余三个不填时会自动用待机图顶替
  petIdleImage: "/backgrounds/7.23.1.gif",   // 待机：默认显示
  petHoverImage: "/backgrounds/7.23.2.gif",                  // 悬停：鼠标移上去（不用点）
  petClickImage: "/backgrounds/7.23.3.gif",                  // 点击：单击一下
  petHoldImage: "/backgrounds/7.23.4.gif",                   // 长按：按住不放超过 0.4 秒

  // 👇 【AI 镜像页】/ai 页面挂载的 AI 列表。只放元数据，绝不放 API Key！
  // 想接入新模型：① 在这里加一条 ② 去 lib/aiProviders.ts 注册对应的调用逻辑
  // ③ 去 Vercel 环境变量里加对应的 Key。三步做完，页面会自动多出一个可切换的 AI 标签。
  aiModels: [
    {
      id: "gemini",                 // 必须和 lib/aiProviders.ts 里注册的 key 一致
      name: "双子星 Gemini",
      avatar: "",                   // 可选：头像/立绘图片链接，留空用默认图标
      themeColor: "#4285F4",        // 主题色，用于该模型的换肤（按钮/边框/强调色）
      background: "",               // 可选：整页背景图链接，留空用默认背景
      greeting: "我是 Gemini，很高兴见到你喵~ 有什么想聊的？",
    },
  ],
  friendLinkApplyFormat: "名称：XingHuiSamaの宝藏之地\n简介：今天我也要学习吗\n链接：https://www.xinghuisama.top\n头像：https://bu.dusays.com/2026/03/24/69c1e38ac1846.jpg",
  enableLevelSystem: true,
};