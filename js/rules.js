/* 个人充电 · 规则库（自拟版，等拿到 PRD 后在这里整体替换）
 * 所有“可调的东西”都在这个文件：状态、耗电来源、权重、公式参数、四维、文案库。
 * 引擎 js/engine.js 只读这个文件，不写死任何数字和文案。
 * 图解对应关系见 RULES.md。
 */
(function (root) {
  var RULES = {
    version: "draft-0.2-no-prd",

    /* ---------- 电量区间（四态：亏电与充电材料） ---------- */
    bands: [
      { key: "low",     label: "严重亏电", min: 0,  max: 24,
        tagline: "电快见底了。今天别逼自己，只做最小的一步就算赢。" },
      { key: "drain",   label: "持续耗电", min: 25, max: 49,
        tagline: "电在一直漏。先别急着充，先看看漏在哪。" },
      { key: "recover", label: "恢复充电", min: 50, max: 74,
        tagline: "在回电的路上了。顺着做点养电的小事，会越来越稳。" },
      { key: "full",    label: "稳定丰盈", min: 75, max: 100,
        tagline: "电挺足。留点余量给自己，也可以分一点给身边的人。" }
    ],

    /* ---------- 公式参数 ----------
     * 今日电量 = clamp( round( 状态基础电量 − Σ(所选耗电来源的“耗电值”) ), 0, 100 )
     * 某维度耗电 = clamp( round( Σ(来源耗电值 × 该来源在此维度的权重) × dimScale + (100 − 状态基础电量) × baseSpread ), 0, 100 )
     */
    formula: {
      dimScale: 4,            // 来源耗电值折算到 0–100 的倍数
      baseSpread: 0.2,        // 状态“底色”平均摊给四个维度的比例
      customDefaultBase: 55,  // 手动输入且没匹配到关键词时的基础电量
      maxSources: 3,
      customMaxLen: 20,
      dimLevels: [            // 维度“耗电程度”文字
        { min: 0,  label: "还好" },
        { min: 25, label: "有点耗" },
        { min: 50, label: "比较耗" },
        { min: 75, label: "很耗" }
      ],
      lowBatteryLimit: 25,    // 低于这个电量：修复动作只给 2 个，并优先“很轻”的
      stableHintLimit: 65     // 没选耗电来源时，基础电量低于此值才用状态推断耗电链路
    },

    /* ---------- 四维耗电地图 ---------- */
    dims: [
      { key: "body",     name: "身体与节律", short: "身体",
        desc: "睡得怎样、吃得怎样、身体累不累、作息乱不乱。",
        map: "对应图里的「节律与生活感」这类充电来源；底层电不够，就是“匮乏”那一环的身体版。" },
      { key: "emotion",  name: "情绪稳定",   short: "情绪",
        desc: "容易上头、发慌、绷着，还是比较稳。",
        map: "对应「恐惧」和耗电链路里的「情绪失控」。" },
      { key: "relation", name: "关系边界",   short: "关系",
        desc: "有没有放不下的人和事，是不是在跟人互相要电。",
        map: "对应「纠缠」和「关系抢电」。" },
      { key: "world",    name: "世界宽度",   short: "世界",
        desc: "每天接触的人、事、风景是不是越来越窄；总觉得不够。",
        map: "对应「世界变窄」和「匮乏」（看不到已有的、也看不到更大的）。" }
    ],

    /* ---------- 耗电链路（图2）：匮乏→纠缠→关系抢电→情绪失控→世界变窄 ---------- */
    chain: [
      { key: "scarcity", name: "匮乏", sub: "内在能量不足",
        now: "你现在大概落在第 1 环「匮乏」：底层电不够，总觉得不够、心里发空。这一环最该做的不是硬撑，是先补一点点。",
        next: "再往下，容易变成放不下、理不清（纠缠）。",
        cut: "最省力的切断点：先看见你已经有的东西，再把睡和吃稳住。" },
      { key: "entangle", name: "纠缠", sub: "放不下、理不清",
        now: "你现在大概落在第 2 环「纠缠」：有件事或有个人一直挂在心上，反复转，反复耗电。",
        next: "再往下，容易变成跟人互相要电（关系抢电）。",
        cut: "最省力的切断点：把挂着的事写下来、说清一次；别在脑子里开一整天的会。" },
      { key: "grab", name: "关系抢电", sub: "互相索取能量",
        now: "你现在大概落在第 3 环「关系抢电」：要么在向别人要回应、要安心，要么被别人一直要。两部手机互相充电，最后两边都亏。",
        next: "再往下，容易情绪上头，发火、崩、冷战（情绪失控）。",
        cut: "最省力的切断点：先给自己充一点，再决定要不要开口；该给的给，不该扛的不扛。" },
      { key: "emotion", name: "情绪失控", sub: "焦灼、愤怒、崩溃",
        now: "你现在大概落在第 4 环「情绪失控」：又急又慌，或者一点就炸、一下就崩。这是漏电最快的一环。",
        next: "再往下，容易越来越不想出门、不想见人、不想看新东西（世界变窄）。",
        cut: "最省力的切断点：先让身体慢下来（呼吸、喝水、换个地方），情绪退一点再处理事情。" },
      { key: "narrow", name: "世界变窄", sub: "视野受限，生活没了颜色",
        now: "你现在大概落在第 5 环「世界变窄」：每天就那几样东西，看不到新的，也不太想动。",
        next: "这一环再不松动，就会回头加重“匮乏”，转成一个圈。",
        cut: "最省力的切断点：每天给自己放一点新东西进来——一个新风景、一首新歌、一条没走过的路。" }
    ],

    /* ---------- 状态选项（Q1 单选，也可手填） ----------
     * base：基础电量；stageHint：没选耗电来源时，用来推断落在耗电链路的哪一环 */
    states: [
      { id: "collapse",  label: "撑不住了，快崩了",     base: 15, stageHint: "emotion",  band: "严重亏电" },
      { id: "empty",     label: "空空的，提不起劲",     base: 28, stageHint: "scarcity", band: "" },
      { id: "anxious",   label: "又急又慌，静不下来",   base: 38, stageHint: "emotion",  band: "" },
      { id: "ruminate",  label: "脑子停不下来，反复想", base: 42, stageHint: "entangle", band: "" },
      { id: "tired",     label: "有点累，还撑得住",     base: 55, stageHint: "scarcity", band: "" },
      { id: "flat",      label: "一般般，平平的",       base: 65, stageHint: null,       band: "" },
      { id: "recovering",label: "缓过来一点了，舒服些", base: 76, stageHint: null,       band: "" },
      { id: "full",      label: "挺稳的，有余量",       base: 90, stageHint: null,       band: "" }
    ],

    /* 手动输入的关键词 → 状态。按顺序匹配，先匹配到的生效（负面在前，避免“不舒服”被当成“舒服”） */
    customKeywords: [
      { id: "collapse", words: ["崩溃", "撑不住", "受不了", "扛不住", "不想活", "绝望"] },
      { id: "anxious",  words: ["焦虑", "着急", "紧张", "慌", "急", "害怕", "心跳", "烦躁"] },
      { id: "ruminate", words: ["想太多", "停不下", "反复", "纠结", "睡不着", "放不下", "胡思乱想"] },
      { id: "empty",    words: ["空", "没劲", "没力气", "麻木", "提不起", "无聊", "低落", "难过", "不开心", "不舒服", "不好", "郁闷", "委屈"] },
      { id: "tired",    words: ["累", "困", "疲", "乏", "没睡好"] },
      { id: "full",     words: ["很稳", "踏实", "充实", "满电", "精力充沛", "状态很好", "特别好"] },
      { id: "recovering", words: ["舒服", "放松", "轻松", "开心", "好多了", "缓过来", "还不错", "挺好"] },
      { id: "flat",     words: ["一般", "还行", "平平", "普通", "没什么"] }
    ],

    /* ---------- 耗电来源（Q2 最多选 3，对应图里 5 类耗电）----------
     * stage：落在耗电链路哪一环；drain：耗电值；w：四维权重（每条加起来 = 1） */
    sources: [
      { id: "enough",  label: "总觉得不够：钱、时间、认可，什么都差一点", stage: "scarcity", drain: 7,
        w: { body: 0.1, emotion: 0.3, relation: 0.2, world: 0.4 } },
      { id: "notgood", label: "觉得自己不够好，特别在意别人怎么看我",     stage: "scarcity", drain: 7,
        w: { body: 0.0, emotion: 0.4, relation: 0.4, world: 0.2 } },
      { id: "body",    label: "身体很累：没睡好，或者吃得乱",             stage: "scarcity", drain: 8,
        w: { body: 0.7, emotion: 0.2, relation: 0.0, world: 0.1 } },
      { id: "stuck",   label: "有件事放不下，脑子里反复转",               stage: "entangle", drain: 7,
        w: { body: 0.1, emotion: 0.4, relation: 0.4, world: 0.1 } },
      { id: "unsaid",  label: "有话没说开，有事一直拖着没理清",           stage: "entangle", drain: 6,
        w: { body: 0.0, emotion: 0.2, relation: 0.6, world: 0.2 } },
      { id: "taking",  label: "被人一直索取：我在给别人“充电”，自己没电了", stage: "grab", drain: 9,
        w: { body: 0.1, emotion: 0.2, relation: 0.6, world: 0.1 } },
      { id: "wanting", label: "总想从某个人那里要回应、要安心",           stage: "grab",     drain: 8,
        w: { body: 0.0, emotion: 0.3, relation: 0.6, world: 0.1 } },
      { id: "future",  label: "担心将来、怕出错、怕失去",                 stage: "emotion",  drain: 8,
        w: { body: 0.1, emotion: 0.6, relation: 0.1, world: 0.2 } },
      { id: "field",   label: "待在让我紧绷的地方，或者让我不自在的人堆里", stage: "emotion", drain: 8,
        w: { body: 0.2, emotion: 0.3, relation: 0.2, world: 0.3 } },
      { id: "burst",   label: "情绪上头：想发火、想哭、冷战，或者崩了一下", stage: "emotion", drain: 9,
        w: { body: 0.1, emotion: 0.6, relation: 0.3, world: 0.0 } },
      { id: "phone",   label: "刷手机停不下来，一晃半天没了",             stage: "narrow",   drain: 6,
        w: { body: 0.3, emotion: 0.2, relation: 0.0, world: 0.5 } },
      { id: "loop",    label: "天天两点一线，很久没见新东西、新的人",     stage: "narrow",   drain: 7,
        w: { body: 0.1, emotion: 0.1, relation: 0.1, world: 0.7 } }
    ],
    noneSource: { id: "none", label: "今天没什么特别耗电的" },

    /* ---------- 六步修复路径（图3）& 五类充电来源（图1） ---------- */
    steps: [
      { n: 1, name: "感恩与看见", line: "看见已经有的，从“不够”慢慢回到“够用”。" },
      { n: 2, name: "扩宽世界",   line: "别把自己关窄了，给信号多开点带宽。" },
      { n: 3, name: "选择好场",   line: "靠近让你稳的人和地方，少待让你耗的。" },
      { n: 4, name: "情绪独立",   line: "别把某一个人当成唯一的充电宝，先把自己的充电口修好。" },
      { n: 5, name: "生活性充电", line: "睡好、吃好、喝杯茶、走几步，这些就是修复。" },
      { n: 6, name: "把自己活出来", line: "你先饱满、先稳，才有余力去爱别人、滋养关系。" }
    ],
    chargeSources: {
      gratitude: { name: "感恩",         line: "看见美好，心里就不那么空" },
      nature:    { name: "天地万物",     line: "和自然连上，生命力就回来一点" },
      loved:     { name: "有爱的人与环境", line: "被理解、被接住、被支持" },
      world:     { name: "丰富世界",     line: "多一点体验，视野就宽一点" },
      rhythm:    { name: "节律与生活感", line: "规律、踏实、过真实的日子" }
    },

    /* ---------- 今日洞察文案 ---------- */
    insights: {
      // 第一段：看电量
      band: {
        low:     "今天是 {n} 分，处在「严重亏电」。说人话：电快见底了，这时候脑子转不动、容易往坏处想，都很正常，不是你不行。今天的目标不是做好，是少漏一点、补一点点。",
        drain:   "今天是 {n} 分，处在「持续耗电」。说人话：你在撑着，电一边用一边漏。别再硬扛，先找到漏在哪，比拼命充更有用。",
        recover: "今天是 {n} 分，处在「恢复充电」。说人话：你已经在往回走了，只是还没满。顺着做一两件养电的小事，就能稳下来。",
        full:    "今天是 {n} 分，处在「稳定丰盈」。说人话：你电挺足的。这时候适合把这份稳留住，也可以做点自己真正想做的事。"
      },
      // 第二段：漏在哪（按漏得最多的维度）
      dim: {
        body:     "漏得最多的是「身体与节律」：身体先累了，心情就跟着往下掉。先把睡、吃、动这几样基本盘稳一稳。",
        emotion:  "漏得最多的是「情绪稳定」：心里一直绷着或者容易上头，电是被情绪一点点漏掉的。有火、有慌，往往是因为你在乎；真正空的是什么感觉都没有。",
        relation: "漏得最多的是「关系边界」：有人或有事一直挂着你。图里说得很直白：两部手机互相充电，最后两部都亏。",
        world:    "漏得最多的是「世界宽度」：看到的、接触的东西越来越少，或者总觉得不够。给生活放一点新东西进来，信号就会宽一些。"
      },
      noDrain: "今天你没选特别耗电的事，说明电不是被某件事拖走的。接下来更适合“养电”，而不是“救火”。",
      // 第三段：自我检查（图3 的 4 个问题），按耗电链路所在环节挑一个
      check: {
        grab:     "停一下，问问自己：我最近是在充电，还是在抢电？",
        entangle: "停一下，问问自己：我最近是在充电，还是在抢电？有没有哪件事、哪个人，一直在占着我的电？",
        emotion:  "停一下，问问自己：什么样的人和环境，会让我更稳一点？",
        narrow:   "停一下，问问自己：我的世界，是不是变窄了？",
        scarcity: "停一下，问问自己：现在最需要修的，是我系统里的哪一块？",
        none:     "停一下，问问自己：我最近是在充电，还是在抢电？"
      },
      shift: "小提醒：把注意力从“他怎么对我”，慢慢挪到“我怎么把自己的充电系统修好”。关键不是从别人身上抢电。",
      disclaimer: "这只是帮你看一眼自己的状态，不是医学判断，也不能代替专业帮助。如果你一直很难受，或者有伤害自己的念头，请尽快联系身边可信的人，或当地的心理援助热线、医院。"
    },

    /* ---------- 修复动作（对应 6 步 + 5 类充电来源）----------
     * step：第几步；src：充电来源；dim：主要补哪一维；minutes：≤3；easy：很轻（电量很低时优先） */
    actions: [
      { id: "a1", step: 1, src: "gratitude", dim: "world", minutes: 2, easy: true,
        title: "找 3 件今天还不错的小事",
        how: ["看看四周，说出 3 样还不错的小东西：热水、窗外的树、有人回了你消息都算。", "每一样用一句话说出来，在心里说或写在备忘录都行。"],
        why: "眼睛习惯盯着缺的，练一练就能看见有的。" },
      { id: "a2", step: 1, src: "gratitude", dim: "relation", minutes: 1, easy: true,
        title: "在心里谢一个人",
        how: ["想一个这周帮过你的人。", "在心里对他说一句具体的话：“谢谢你那天……”，不用发给他。"],
        why: "想到被人支持过，心里会软一点，也没那么孤单。" },
      { id: "a3", step: 1, src: "gratitude", dim: "emotion", minutes: 3, easy: false,
        title: "写下 3 样“我已经有的”",
        how: ["拿张纸或打开备忘录，写 3 样：身体还能做的事、你住的地方、你认识的人。", "每样写一句“有它，我可以……”。"],
        why: "从“什么都不够”慢慢回到“其实有些是够的”。" },
      { id: "b1", step: 2, src: "nature", dim: "world", minutes: 1, easy: true,
        title: "走到窗边，看最远的地方",
        how: ["站到窗边或门口，找视线里最远的一样东西，看 30 秒。", "再看近处的一样，来回换三次。"],
        why: "眼睛放远，脑子也会松一点。" },
      { id: "b2", step: 2, src: "world", dim: "world", minutes: 3, easy: false,
        title: "认真看一个新东西",
        how: ["随便找一个跟你日常不相关的东西：一种植物、一首没听过的曲子、一幅山水画。", "不划走，认真看或听满 3 分钟。"],
        why: "给世界开个小口子，视野会宽一点。" },
      { id: "b3", step: 2, src: "world", dim: "body", minutes: 2, easy: true,
        title: "换个位置、换条路",
        how: ["换个地方坐，或者去倒水时多绕一小段路。", "留意一样你平时没留意的东西。"],
        why: "一点点新鲜感，就能打破“天天一样”。" },
      { id: "c1", step: 3, src: "loved", dim: "emotion", minutes: 2, easy: true,
        title: "换到最让你放松的角落",
        how: ["起身，去屋里最舒服的那个角落坐下。", "把不急的通知关掉，坐满 2 分钟。"],
        why: "环境对人的影响很直接，先给自己一个“好场”。" },
      { id: "c2", step: 3, src: "loved", dim: "relation", minutes: 2, easy: true,
        title: "把耗你的对话静音一小时",
        how: ["想想哪个群或对话最让你绷着。", "把它设成免打扰 1 小时，这一小时只管自己。"],
        why: "少待一会儿让你耗的地方，不是冷漠，是保电。" },
      { id: "c3", step: 3, src: "loved", dim: "emotion", minutes: 3, easy: false,
        title: "想一个让你稳的人",
        how: ["想一个和 TA 待着你会放松的人，想想 TA 说话的样子。", "在手机里给 TA 留个提醒：“这周约一下”。"],
        why: "知道自己有“好场”可以回，心里就有底。" },
      { id: "d1", step: 4, src: "loved", dim: "emotion", minutes: 3, easy: false,
        title: "把情绪放回自己身上",
        how: ["一只手放在胸口。", "对自己说：“我现在是（累／慌／气），这是我的感觉，我先陪它 3 分钟。”"],
        why: "先陪自己，再去处理别人，不用把情绪全丢给对方接。" },
      { id: "d2", step: 4, src: "loved", dim: "relation", minutes: 3, easy: false,
        title: "把“我想要他……”改成“我可以先……”",
        how: ["写下一句：“我想让他……”。", "再改写成：“我自己可以先……”，比如先睡一会儿、先出去走走。"],
        why: "把期待从别人身上收回一点，是在修自己的充电口。" },
      { id: "d3", step: 4, src: "rhythm", dim: "emotion", minutes: 1, easy: true,
        title: "慢呼吸 5 轮",
        how: ["鼻子慢慢吸气 4 秒，嘴巴慢慢呼气 6 秒。", "做 5 轮，肩膀往下放。"],
        why: "身体慢下来，情绪就退一点，这是最快的一招。" },
      { id: "e1", step: 5, src: "rhythm", dim: "body", minutes: 3, easy: true,
        title: "泡杯热茶，只喝它",
        how: ["烧点热水，泡杯茶或喝杯热水。", "这 3 分钟只喝这一杯：闻一闻、烫不烫、咽下去的感觉。"],
        why: "把注意力拉回当下，不被别的事勾着走。" },
      { id: "e2", step: 5, src: "nature", dim: "body", minutes: 3, easy: false,
        title: "站起来走 3 分钟",
        how: ["出门或在屋里走，不看手机。", "留意脚落地的感觉，和吹到脸上的风。"],
        why: "身体动起来，脑子里的东西会松开一点。" },
      { id: "e3", step: 5, src: "rhythm", dim: "body", minutes: 1, easy: true,
        title: "把今晚的睡觉时间定下来",
        how: ["设一个“该睡了”的闹钟，比平时早 15 分钟。", "再想好睡前最后一件事，比如洗脸、关灯。"],
        why: "规律的睡，是最划算的充电。" },
      { id: "f1", step: 6, src: "rhythm", dim: "emotion", minutes: 3, easy: false,
        title: "做一件今天只为自己的小事",
        how: ["选一件不用交代、不为谁的小事：听一首喜欢的歌、画两笔、吃块喜欢的点心。", "做的时候不评价，只是享受。"],
        why: "你先被养一下，才有力气去养别的。" },
      { id: "f2", step: 6, src: "gratitude", dim: "world", minutes: 2, easy: true,
        title: "写一句“我想成为什么样的人”",
        how: ["写一句：“我想成为……的人。”要具体，比如“说话不着急的人”。", "再写一个今天就能做的小动作。"],
        why: "把注意力放回自己想活的样子上。" },
      { id: "f3", step: 6, src: "world", dim: "world", minutes: 3, easy: false,
        title: "把拖着的一件小事做 3 分钟",
        how: ["挑一件你想做但一直拖的小事。", "定个 3 分钟的计时，只做这 3 分钟，到点就可以停。"],
        why: "开了头，人会有“我在往前走”的感觉。" }
    ],
    /* 不同耗电环节优先补哪几步（按顺序加权 3/2/1）；null = 没落在耗电链路 */
    stepPriority: {
      scarcity: [1, 5, 2],
      entangle: [4, 3, 1],
      grab:     [4, 3, 5],
      emotion:  [5, 4, 3],
      narrow:   [2, 3, 1],
      none:     [6, 1, 5]
    },
    maxActions: 3, maxActionsLow: 2,

    /* ---------- 场域推荐（对应“选择好场”）---------- */
    fields: [
      { id: "corner", title: "家里最舒服的一个角落", easy: true,
        stages: ["emotion", "entangle"], dims: ["emotion", "body"],
        why: "熟悉、安全，不用应付谁。", use: "坐 10 分钟，手机放远一点。" },
      { id: "window", title: "窗边或阳台，晒晒太阳", easy: true,
        stages: ["scarcity", "narrow"], dims: ["body", "world"],
        why: "光和空气，是最便宜的充电。", use: "站 5 分钟，看远处，不刷手机。" },
      { id: "park", title: "楼下的公园或绿道", easy: false,
        stages: ["narrow", "scarcity", "emotion"], dims: ["world", "body"],
        why: "绿色和风，让人和天地万物连上。", use: "慢慢走一圈，留意三种颜色。" },
      { id: "water", title: "水边：河边、湖边，喷泉也行", easy: false,
        stages: ["emotion", "entangle"], dims: ["emotion"],
        why: "看流动的水，容易让脑子慢下来。", use: "站着或坐着看 5 分钟。" },
      { id: "cafe", title: "安静的咖啡店或书店", easy: false,
        stages: ["narrow", "entangle"], dims: ["world", "emotion"],
        why: "有人气，又不用跟谁说话。", use: "点杯喜欢的，翻一本平时不看的书。" },
      { id: "stable", title: "一个让你踏实的人身边", easy: false,
        stages: ["grab", "scarcity", "emotion"], dims: ["relation", "emotion"],
        why: "有爱的人和环境，会让人被接住。", use: "不用聊什么，坐一会儿就行。" },
      { id: "museum", title: "图书馆、美术馆或小展览", easy: false,
        stages: ["narrow"], dims: ["world"],
        why: "接触没见过的东西，视野会宽。", use: "只挑一件作品或一本书，看久一点。" },
      { id: "market", title: "菜市场或有烟火气的小街", easy: false,
        stages: ["narrow", "scarcity"], dims: ["world", "body"],
        why: "真实的生活感，会让人踏实。", use: "买一样最新鲜的东西回家。" },
      { id: "quiet", title: "一个没人找你的独处空间", easy: true,
        stages: ["grab", "entangle", "emotion"], dims: ["relation", "emotion"],
        why: "先从“互相要电”里退出来，喘口气。", use: "关掉提醒，安静待 15 分钟。" },
      { id: "kitchen", title: "厨房：做一顿简单的饭", easy: false,
        stages: ["scarcity", "narrow"], dims: ["body", "world"],
        why: "有节奏、有香味，是很实在的充电。", use: "煮碗面也行，认真吃完。" }
    ],
    maxFields: 3,
    // 对应耗电环节，建议先少待的“场”
    fieldAvoid: {
      scarcity: "先少待：总拿自己跟别人比的地方（刷朋友圈、刷对比的帖子）。",
      entangle: "先少待：会一直提醒你那件事的聊天窗口、群。",
      grab:     "先少待：每次聊完都觉得被掏空的对话；该说“今天不行”就说。",
      emotion:  "先少待：吵闹、紧绷、让你不敢放松的地方和人堆。",
      narrow:   "先少待：一个人窝着刷屏的状态，越刷越窄。",
      none:     "今天没有特别要躲的场，保持就好。"
    },

    /* ---------- 关系训练（对应“关系抢电 / 情绪独立”）---------- */
    trainings: [
      { id: "r1", stages: ["grab"], title: "先充自己，再开口",
        when: "你很想从某个人那里要回应、要安心的时候。",
        steps: ["先停 2 分钟，做 5 轮慢呼吸。", "问自己：我想要的这个，我自己能先给自己一点吗？", "再决定要不要说，说的时候讲你的感受，不讲“你应该”。"],
        say: "“我现在有点不安，想听你说句话。不过我先自己缓一缓，等下再聊。”" },
      { id: "r2", stages: ["grab"], title: "不当别人的充电宝",
        when: "有人一直找你倾诉、索取，你已经没电的时候。",
        steps: ["先说清你现在能给多少。", "给完就收，不要硬撑到底。", "事后给自己留一段安静的时间。"],
        say: "“我现在电量不太够，今天能陪你 10 分钟，之后我要休息一下。”" },
      { id: "r3", stages: ["grab", "entangle"], title: "把“他怎么对我”换成“我怎么修自己”",
        when: "你反复想“他为什么这样对我”的时候。",
        steps: ["写下你最常重复的那句“他怎么对我……”。", "改写成：“这件事里，我自己可以先修的是……”。", "只选一个今天就能做的小动作。"],
        say: "“这件事我先照顾好自己的部分，再看要怎么跟你说。”" },
      { id: "r4", stages: ["entangle"], title: "一件事，一次说清",
        when: "有话没说开，一直拖在心里的时候。",
        steps: ["写三句：发生了什么／我的感受／我希望怎样。", "不一定要发出去，先写给自己看。", "想好了，再选一个双方都不累的时间说。"],
        say: "“有件事我想跟你好好说一下，你什么时候方便？”" },
      { id: "r5", stages: ["emotion"], title: "上头了，先暂停 20 分钟",
        when: "你快要发火、哭出来，或者想冷战的时候。",
        steps: ["先说出暂停，不扔狠话。", "离开现场 20 分钟，喝水、走路、慢呼吸。", "回来再说，先说你的感受。"],
        say: "“我现在情绪有点上头，我们先停 20 分钟，之后我再接着说。”" },
      { id: "r6", stages: ["scarcity", "emotion"], title: "找出你的“稳人”",
        when: "你觉得没人懂、心里发空的时候。",
        steps: ["写下 2 个和 TA 待着你会放松的人。", "这周约其中一个，哪怕只是喝杯茶。", "见面时不用演，累就说累。"],
        say: "“最近有点累，想跟你待一会儿，不聊也行。”" },
      { id: "r7", stages: ["grab", "narrow"], title: "两部手机，各自先充好",
        when: "你和亲近的人总是互相“要”，谁都没被喂饱的时候。",
        steps: ["各自说一件“我自己这周要为自己做的事”。", "约好：不是你来救我，也不是我来救你，是各自先充。", "充完再一起做点开心的事。"],
        say: "“我们这周各自先把自己照顾好，周末再一起吃顿饭，好不好？”" }
    ],
    maxTrainings: 2,
    trainingTwoWhen: { relationDimMin: 50, stages: ["grab", "entangle"] },

    /* ---------- 页面常用文案 ---------- */
    copy: {
      appName: "个人充电",
      slogan: "30 秒看见电量，3 分钟修一修。",
      closing: "先把自己接上世界，你才会重新有电。",
      coreLine: "关键不是从别人身上抢电，而是把自己的 WIFI 充电系统修好。"
    }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = RULES;
  else root.RULES = RULES;
})(typeof window !== "undefined" ? window : globalThis);
