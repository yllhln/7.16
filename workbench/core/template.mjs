const marker = /^([A-Za-z][\w]*)\s*:\s*\{([^{}]*)\}\s*(?:#(.*))?$/;
const fixed = /^([A-Za-z][\w]*)\s*:\s*(.+?)\s+#固定 ID\s*$/;
const fixedTemplateLine = /^([A-Za-z][\w]*)\s*:\s*(.+?)\s+#固定 ID\s*$/;
const valueLine = /^#=\s*(.*)$/;
const blockStart = /^#(.+?)\s+BEGIN\s*$/;
const blockEnd = /^#(.+?)\s+END\s*$/;
const inlineField = /^([A-Za-z][\w]*)\s*:\s*(.+?)\s*#/;
const commentOnly = /^\s*#/;

const fieldComments = {
  'live2d-model': {
    id: '唯一标识，不能重复',
    displayName: '显示名称（昵称）',
    format: '模型文件格式，默认 moc3（可选 moc/moc3/cubism2/cubism4）',
    publicModelPath: '模型文件的访问路径（相对路径，如 live2d/小猫咪/小猫咪.moc3）',
    mappingPath: '映射文件路径，默认留空或填 mapping.json',
    status: '启用状态（启用 active，禁用 disabled）',
  },
  'character': {
    id: '唯一标识，不能重复',
    name: '角色显示名称',
    systemPrompt: '角色系统提示词（定义角色性格、说话风格的长文本）',
    enabled: '是否启用该角色',
    live2dModelId: '关联的 Live2D 模型 ID（需先在 Live2D 模型列表中存在）',
    backgroundId: '关联的背景 ID（需先在背景列表中存在）',
    aiProfileId: '关联的 AI 配置 ID（需先在 AI 配置列表中存在）',
    ttsProfileId: '关联的 TTS 配置 ID（需先在 TTS 配置列表中存在）',
    behaviorProfileId: '关联的行为配置 ID（需先在行为配置列表中存在）',
  },
  'ai-profile': {
    id: '唯一标识，不能重复',
    displayName: '显示名称',
    adapter: '适配器类型（如 openai-compatible、gemini）',
    baseUrl: 'API 基础 URL（如 https://api.openai.com/v1）',
    baseUrlEnv: '基础 URL 环境变量名（不填写实际 URL 时使用，如 AI_CHAT_BASE_URL）',
    apiKeyEnv: 'API Key 环境变量名（如 AI_CHAT_API_KEY，切勿直接写密钥）',
    modelId: '模型标识（如 gpt-4o、gemini-pro）',
    enabled: '是否启用该配置',
    parameters: '额外参数 JSON 对象（如 {"temperature":0.7}）',
  },
  'tts-profile': {
    id: '唯一标识，不能重复',
    displayName: '显示名称',
    adapter: '适配器类型（如 openai-compatible、volcengine）',
    apiUrl: 'API 请求地址（如 https://api.openai.com/v1/audio/speech）',
    apiUrlEnv: 'API URL 环境变量名（如 TTS_BASE_URL）',
    apiKeyEnv: 'API Key 环境变量名（如 TTS_API_KEY，切勿直接写密钥）',
    voiceId: '音色标识（如 alloy、zh-CN-XiaoxiaoNeural）',
    enabled: '是否启用该配置',
    parameters: '额外参数 JSON 对象（如 {"speed":1.0}）',
  },
  'behavior-profile': {
    id: '唯一标识，不能重复',
    displayName: '显示名称',
    emotions: '情绪映射 JSON 对象（如 {"happy":{"expression":"笑","motion":"1.motion3.json"}}）',
  },
  'background': {
    id: '唯一标识，不能重复',
    displayName: '显示名称',
    publicPath: '背景图片访问路径（相对路径，如 /assets/site/background.png）',
    enabled: '是否启用该背景',
  },
  'post': {
    id: '文章唯一标识（英文、数字、下划线、短横线）',
    title: '文章标题',
    date: '发布日期（ISO 格式，如 2026-08-27T00:00:00）',
    description: '文章摘要/描述（用于列表页预览）',
    cover: '封面图片路径（相对路径或 URL）',
    tags: '标签数组（如 ["技术","随笔"]）',
    mood: '心情标记（如 开心、思考）',
  },
  'chatter': {
    id: '杂谈唯一标识（英文、数字、下划线、短横线）',
    title: '杂谈标题',
    date: '发布日期（ISO 格式，如 2026-08-27T00:00:00）',
    description: '摘要/描述（用于列表页预览）',
    cover: '封面图片路径（相对路径或 URL）',
    tags: '标签数组（如 ["生活","碎碎念"]）',
    mood: '心情标记（如 平静、兴奋）',
  },
  'moment': {
    id: '说说唯一标识（英文、数字、下划线、短横线，或留空自动生成）',
    date: '发布日期时间（ISO 格式，如 2026-08-27T15:30:00）',
    location: '位置/地点（如 家、公司、咖啡厅）',
    images: '图片路径数组（如 ["/assets/moments/1.jpg","/assets/moments/2.jpg"]）',
  },
  'about': {
    title: '关于页标题',
    date: '更新日期（ISO 格式）',
    tags: '标签数组',
    mood: '心情标记',
    cover: '封面图片路径',
    description: '关于页简介描述',
  },
  'album': {
    id: '相册唯一标识',
    title: '相册标题',
    description: '相册描述',
    cover: '相册封面图路径',
    date: '创建日期（字符串，如 2026-08-27）',
    photos: '照片对象数组（每个对象含 url、caption 等字段）',
  },
  'friend': {
    id: '友链唯一标识',
    name: '友链站点名称',
    url: '友链站点地址（必须以 http/https 开头）',
    description: '站点简介描述',
    avatar: '站点头像图片路径',
    themeColor: '主题色（十六进制如 #0f766e 或 rgba 值）',
  },
  'project': {
    id: '项目唯一标识',
    name: '项目名称',
    description: '项目描述',
    icon: '项目图标（emoji 或字体图标类名，如 🚀）',
    githubUrl: 'GitHub 仓库地址（必须以 http/https 开头）',
    tags: '技术标签数组（如 ["Gromacs","RMSF"]）',
  },
  'site-config': {
    title: '网站标题（显示在浏览器标签和首页）',
    faviconUrl: '网站图标路径（如 /assets/pets/muqiu/avatar.png）',
    authorName: '作者名称',
    bio: '个人简介（显示在首页/关于页）',
    navTitle: '导航栏主标题',
    navSuffix: '导航栏后缀（如 の）',
    navAfter: '导航栏后缀文本（如 楚子航）',
    avatarUrl: '头像图片路径',
    useGradient: '是否启用渐变背景',
    themeColors: '主题色数组（如 ["#0f766e","#0f172a","#c2410c","#e2e8f0"]）',
    bgImages: '背景图片数组（如 ["/assets/site/background.png","/assets/site/cover.png"]）',
    aiPageBackground: 'AI 页面背景图路径',
    aiChatBackground: 'AI 聊天背景图路径',
    defaultPostCover: '文章默认封面图路径',
    photoWallImage: '相册墙背景图路径',
    social: '社交链接对象（含 github、email、qq、wechat 等字段）',
    counts: '统计计数对象（如 {"photos":128}）',
    chatterTitle: '杂谈页面标题',
    chatterDescription: '杂谈页面描述',
    danmakuList: '弹幕文案数组（如 ["在干嘛呢？","前方高能！"]）',
    gitalkConfig: 'Gitalk 评论配置对象（含 clientID、clientSecret、repo、owner、admin）',
    buildDate: '构建日期（ISO 字符串，如 2026-03-23T00:00:00）',
    footerBadges: '页脚徽章数组',
    icpConfig: 'ICP 备案配置对象（含 name、link）',
    friendLinkApplyFormat: '友链申请模板文本（多行字符串）',
    enableLevelSystem: '是否启用等级系统',
  },
};

function getComment(resourceId, fieldName, isFixedId = false) {
  const map = fieldComments[resourceId];
  if (map && map[fieldName]) {
    let comment = map[fieldName];
    if (isFixedId) comment += '（固定 ID，编辑时不可修改）';
    return comment;
  }
  // 兜底：字段名 + 类型提示
  return `${fieldName}`;
}

function defaultForType(type) {
  if (type.endsWith('[]')) return '[]';
  if (type === 'object') return '{}';
  if (type === 'boolean') return 'false';
  return '""';
}

export function createTemplate(resource, data = {}, body = '', { isNew = false } = {}) {
  const idField = resource.storage.idField || resource.template?.idField;
  const lines = [`# Workbench resource: ${resource.id}`];
  for (const field of resource.fields || []) {
    const name = field.name;
    if (name === idField && !isNew) {
      lines.push(`${name}: ${JSON.stringify(data[name] ?? '')}  # ${getComment(resource.id, name, true)}`);
      continue;
    }
    const empty = data[name] ?? (isNew ? defaultForType(field.type) : '');
    const val = typeof empty === 'string' ? JSON.stringify(empty) : JSON.stringify(empty);
    lines.push(`${name}: ${val}  # ${getComment(resource.id, name)}`);
  }
  if (resource.template?.body) lines.push(`#${resource.template.body} BEGIN`, body || '', `#${resource.template.body} END`);
  return lines.join('\n') + '\n';
}

export function parseTemplate(text, resource, { isNew = false, original = {} } = {}) {
  const result = {};
  const idField = resource.storage.idField || resource.template?.idField;
  const seen = new Set();
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  let body = '';
  let activeBlock = false;
  let foundBody = false;
  for (const line of lines) {
    if (activeBlock) {
      const end = blockEnd.exec(line);
      if (end) { if (end[1] !== resource.template.body) throw new Error('正文结束标记无效: ' + line); activeBlock = false; continue; }
      body = (body === '' ? line : body + '\n' + line);
      continue;
    }
    const start = blockStart.exec(line);
    if (start) {
      if (foundBody || start[1] !== resource.template?.body) throw new Error('正文区块标记无效: ' + line);
      activeBlock = true;
      foundBody = true;
      continue;
    }
    if (!line.trim() || line.startsWith('# Workbench resource:')) continue;

    const fixedMatch = fixed.exec(line);
    if (fixedMatch) {
      const [, name, raw] = fixedMatch;
      if (name !== idField || isNew) throw new Error('固定 ID 行无效: ' + name);
      if (JSON.parse(raw) !== original[name]) throw new Error('编辑时不可修改 ID: ' + name);
      seen.add(name);
      result[name] = original[name];
      continue;
    }

    const decl = marker.exec(line);
    if (decl) {
      throw new Error('检测到旧版占位符格式，请使用新格式：字段名: "值"  # 说明');
    }

    const inline = inlineField.exec(line);
    if (inline) {
      const name = inline[1];
      if (!resource.fields.some(f => f.name === name)) throw new Error('未登记字段: ' + name);
      if (seen.has(name)) throw new Error('字段重复: ' + name);
      const field = resource.fields.find(f => f.name === name);
      let value;
      try {
        const rawVal = inline[2].trim();
        value = JSON.parse(rawVal);
      } catch {
        throw new Error(`字段 ${name} 的值必须是合法 JSON：${inline[2]}`);
      }
      if (!isNew && name === idField && value !== original[name]) throw new Error('编辑时不可修改 ID: ' + name);
      if (!isNew && name === idField) value = original[name];
      result[name] = value;
      seen.add(name);
      continue;
    }

    if (line.startsWith('#=')) {
      throw new Error('检测到旧版 #= 赋值行，请改用单行 字段名: "值"  # 说明 格式');
    }

    if (commentOnly.test(line.trimStart())) continue;
    throw new Error('无法解析模板行（请用 字段名: "值"  # 说明 格式）：' + line);
  }
  if (activeBlock) throw new Error('正文区块缺少 END 标记');
  for (const field of resource.fields || []) if (!seen.has(field.name)) throw new Error('模板缺少字段: ' + field.name);
  if (resource.template?.body && !foundBody) throw new Error('模板缺少正文区块');
  if (resource.template?.body) result.__body = body;
  return result;
}