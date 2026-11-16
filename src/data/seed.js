export const COLLEGES = ['信息工程学院', '建筑工程学院', '经济管理学院', '财会金融学院']

export const CATEGORIES = [
  { id: 'books', label: '书籍教材', icon: 'book' },
  { id: 'digital', label: '数码电子', icon: 'headphones' },
  { id: 'living', label: '宿舍生活', icon: 'lamp' },
  { id: 'fashion', label: '服饰配件', icon: 'bag' },
  { id: 'sports', label: '运动出行', icon: 'bike' },
  { id: 'tools', label: '学习工具', icon: 'pen' },
]

// Normalized against the supplied 1.jpg. Marker coordinates remain independent
// of the displayed image dimensions.
export const LOCATIONS = [
  { id: 'library', name: '图书馆', x: 0.64, y: 0.56 },
  { id: 'teaching', name: '教学楼', x: 0.83, y: 0.64 },
  // Keep the existing ID so saved products and orders continue to resolve.
  { id: 'tianming', name: '实训楼', x: 0.57, y: 0.70 },
  { id: 'innovation', name: '科创楼', x: 0.87, y: 0.72 },
  { id: 'stadium', name: '体育场', x: 0.24, y: 0.69 },
  { id: 'gate', name: '大门口', x: 0.81, y: 0.955 },
  { id: 'southwest', name: '西南二门', x: 0.37, y: 0.965 },
]

export const PROFILES = [
  { id: 'student-1', username: 'student01', displayName: '林小满', college: COLLEGES[0], role: 'student', status: 'active' },
  { id: 'student-2', username: 'student02', displayName: '陈知夏', college: COLLEGES[1], role: 'student', status: 'active' },
  { id: 'student-3', username: 'student03', displayName: '许星野', college: COLLEGES[2], role: 'student', status: 'active' },
  { id: 'student-4', username: 'student04', displayName: '周予安', college: COLLEGES[3], role: 'student', status: 'active' },
]

const catalog = [
  ['读过的书，还想遇见你', 'books', 18, 48, '轻微使用', '文学书里的折角，是上一段大学时光。内页干净，少量铅笔划线，送一枚手写书签。', '这本书陪我度过了好几个安静的下午，希望下一位主人也喜欢。'],
  ['专业阅读与商业思维书', 'books', 12, 49, '正常使用', '商业与创业主题阅读书籍，封面完整，部分章节有学习标记。适合课余阅读，具体书目与同学确认。', '换一个角度看世界，也把思考的火花传下去。'],
  ['钢笔与手写笔记套装', 'books', 8, 25, '轻微使用', '钢笔与笔记组合，适合记录课堂重点或日常练字。笔记本有少量使用记录，交接时可检查书写情况。', '还没写完的篇章，就交给你啦。'],
  ['英语学习书籍一组', 'books', 15, 68, '轻微使用', '英语阅读与词汇学习书，内页有少量学习标记。适合日常阅读和复习，书籍情况见实拍。', '把背过的单词和一些好运一起传递。'],
  ['一副耳机，一整个安静下午', 'digital', 65, 189, '几乎全新', '头戴式耳机，耳垫与头梁状态良好，声音正常。已清洁，可以现场试听，具体外观见图片。', '赶课程设计时，它给了我一小片自己的空间。'],
  ['带着相机，再看一次校园', 'digital', 320, 799, '正常使用', '入门相机，日常拍照功能正常，有使用痕迹。欢迎当面检查拍摄效果，附基本配件。', '这里面曾装过操场的晚霞和朋友的笑脸。'],
  ['敲下下一段故事的键盘', 'digital', 58, 159, '轻微使用', '桌面键盘，按键回弹正常，键帽已清洁。适合宿舍学习使用，可在交接时连接测试。', '毕业论文的最后一个句号，就是用它敲下的。'],
  ['轻装出发的学习平板', 'digital', 480, 1299, '正常使用', '用于网课和阅读的平板，屏幕与触控功能正常，边框有轻微使用痕迹。面交时自行检查确认。', '希望它还能陪你度过很多个自习日。'],
  ['留一盏灯，给晚归的灵感', 'living', 28, 79, '几乎全新', '桌面阅读灯，照明正常，灯罩和底座状态良好。已擦拭整理，适合书桌与床头。', '它见证了期末，也照亮过很多个“再学一会儿”。'],
  ['一只杯子的温柔日常', 'living', 12, 39, '几乎全新', '日常水杯，杯口无磕碰。已经清洗整理，颜色和款式以照片为准。', '把温柔的早晨，也一起留给你。'],
  ['宿舍抽屉收纳柜', 'living', 15, 45, '轻微使用', '多层塑料抽屉收纳柜，适合整理宿舍里的衣物和日常小物。抽屉可正常开合，外观有少量使用痕迹，尺寸可私信确认。', '小小的空间，也值得被认真整理。'],
  ['夏天还有风的小风扇', 'living', 22, 69, '正常使用', '小型桌面风扇，风量调节正常，已完成清洁。交接时可现场通电检查。', '愿下一阵夏日的风，仍然温柔。'],
  ['深蓝双肩包，装下课本与远方', 'fashion', 16, 59, '轻微使用', '深蓝色双肩背包，适合装日常课本与随身小物。已清洁，肩带和缝线状态良好，具体尺寸可私信确认。', '背着它上了很多节课，现在想让它去新的地方。'],
  ['留给初夏的轻盈衬衫', 'fashion', 25, 99, '几乎全新', '日常休闲衬衫，已清洗整理，无明显污渍。请先私信确认尺码，再约时间面交。', '穿过一次的晴天，想分享给你。'],
  ['一起走过校园的休闲鞋', 'fashion', 45, 199, '轻微使用', '日常休闲鞋，鞋底磨损较轻，已经清洁。尺码与详细情况可在聊天中确认。', '从图书馆到操场，走过的路都算数。'],
  ['把夏日阳光收进帽檐', 'fashion', 12, 49, '几乎全新', '休闲帽，帽围可调，外观干净。颜色和质感见照片，适合日常出行。', '新的夏天，也要记得抬头看云。'],
  ['骑着单车，慢慢逛校园', 'sports', 160, 499, '正常使用', '校园通勤自行车，刹车与轮胎状态正常，有日常使用痕迹。交接时请现场试骑。', '下课后绕远一点，能遇见更好看的晚霞。'],
  ['再约一场球的球拍', 'sports', 35, 129, '轻微使用', '日常运动球拍，拍框完整，握把有轻微使用痕迹。适合课余休闲运动。', '比输赢更珍贵的，是一起流过的汗。'],
  ['操场上的下一次传球', 'sports', 38, 119, '正常使用', '日常训练用篮球，弹性正常，表面有使用痕迹。可在体育场交接时试用。', '毕业以后，也别忘了好好运动。'],
  ['滑向新的夏天', 'sports', 85, 239, '轻微使用', '入门休闲滑板，轮子转动正常，板面有轻微使用痕迹。建议现场检查，注意佩戴护具。', '从第一次站上去，到学会不害怕。'],
  ['算得清数字，算不完青春', 'tools', 18, 59, '几乎全新', '学习用计算器，按键与显示正常。适合日常计算，是否符合课程要求请自行核对。', '考过的试和做过的题，都会变成底气。'],
  ['把校园的颜色画下来', 'tools', 28, 98, '轻微使用', '绘画工具，适合日常速写与创作。部分工具有使用痕迹，具体数量以交接清点为准。', '总有一些颜色，适合留在毕业的夏天。'],
  ['装满灵感的小笔袋', 'tools', 9, 29, '几乎全新', '日常文具笔袋，拉链顺畅，内部整洁。可装常用笔与小件文具。', '把下一次灵光一现，装进口袋。'],
  ['认真画好每一个圆的制图圆规', 'tools', 16, 59, '轻微使用', '学习用制图圆规，适合日常绘图与课程练习。有轻微使用痕迹，交接时可现场检查调节与画圆情况。', '愿你画出的每一个圆，都装得下喜欢的未来。'],
]

export function initialMarketData() {
  const profiles = Object.fromEntries(PROFILES.map(p => [p.id, { ...p }]))
  const products = catalog.map((item, index) => {
    const seller = PROFILES[Math.floor(index / 6)]
    return {
      id: `product-${String(index + 1).padStart(2, '0')}`,
      title: item[0], category: item[1], price: item[2], originalPrice: item[3],
      condition: item[4], description: item[5], story: item[6],
      college: seller.college, sellerId: seller.id, sellerName: seller.displayName,
      locationId: LOCATIONS[index % LOCATIONS.length].id,
      images: [`/images/products/${String(index + 1).padStart(2, '0')}.jpg`],
      status: 'available', createdAt: new Date(Date.now() - (index + 1) * 90 * 60_000).toISOString(),
      tags: index % 3 === 0 ? ['毕业转让', '可小刀'] : index % 3 === 1 ? ['校内面交'] : ['毕业转让'],
    }
  })
  const messages = [
    { id: 'seed-message-1', senderId: 'student-2', receiverId: 'student-1', productId: 'product-01', text: '你好，这本书还在吗？想在图书馆门口交接。', createdAt: new Date(Date.now() - 120 * 60_000).toISOString(), read: true },
    { id: 'seed-message-2', senderId: 'student-1', receiverId: 'student-2', productId: 'product-01', text: '还在的！内页很干净，图书馆门口可以。', createdAt: new Date(Date.now() - 118 * 60_000).toISOString(), read: false },
    { id: 'seed-message-3', senderId: 'student-3', receiverId: 'student-4', productId: 'product-21', text: '同学你好，计算器可以现场试一下吗？', createdAt: new Date(Date.now() - 150 * 60_000).toISOString(), read: true },
    { id: 'seed-message-4', senderId: 'student-4', receiverId: 'student-3', productId: 'product-21', text: '当然可以，面交的时候慢慢检查就好。', createdAt: new Date(Date.now() - 145 * 60_000).toISOString(), read: false },
  ]
  return { version: 1, products, orders: [], messages, favorites: {}, carts: {}, profiles }
}
