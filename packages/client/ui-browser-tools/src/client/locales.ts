/** `browserTools` namespace dictionaries for the browser tool rows. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'browserTools'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': '浏览器',
  'preparing': '正在准备浏览器操作',
  'running': '浏览器操作进行中',
  'failed': '浏览器操作失败',
  'stopped': '已停止',
  'output': '结果',
  'inspect': '检查',
  'action.tabs': '查看标签页',
  'action.open': '打开页面',
  'action.navigate': '跳转',
  'action.snapshot': '读取页面',
  'action.click': '点击元素',
  'action.type': '输入文本',
  'action.press': '按键',
  'action.scroll': '滚动',
  'action.screenshot': '截图',
} satisfies Record<string, string>

/** The `browserTools` namespace key union. */
export type BrowserToolsKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Browser tool row labels. */
    browserTools: BrowserToolsKey
  }
}

/** English dictionary, checked against the Chinese keys. */
export const en = {
  'title': 'Browser',
  'preparing': 'Preparing a browser action',
  'running': 'Browser action in progress',
  'failed': 'Browser action failed',
  'stopped': 'Stopped',
  'output': 'Result',
  'inspect': 'Inspect',
  'action.tabs': 'List tabs',
  'action.open': 'Open page',
  'action.navigate': 'Navigate',
  'action.snapshot': 'Read page',
  'action.click': 'Click element',
  'action.type': 'Type text',
  'action.press': 'Press key',
  'action.scroll': 'Scroll',
  'action.screenshot': 'Screenshot',
} satisfies Record<BrowserToolsKey, string>

/** Japanese dictionary. */
export const ja = {
  'title': 'ブラウザー',
  'preparing': 'ブラウザー操作を準備中',
  'running': 'ブラウザー操作を実行中',
  'failed': 'ブラウザー操作に失敗しました',
  'stopped': '停止しました',
  'output': '結果',
  'inspect': '検査',
  'action.tabs': 'タブを一覧表示',
  'action.open': 'ページを開く',
  'action.navigate': '移動',
  'action.snapshot': 'ページを読む',
  'action.click': '要素をクリック',
  'action.type': 'テキストを入力',
  'action.press': 'キーを押す',
  'action.scroll': 'スクロール',
  'action.screenshot': 'スクリーンショット',
} satisfies Record<BrowserToolsKey, string>

/** Spanish dictionary. */
export const es = {
  'title': 'Navegador',
  'preparing': 'Preparando una acción del navegador',
  'running': 'Acción del navegador en curso',
  'failed': 'La acción del navegador falló',
  'stopped': 'Detenido',
  'output': 'Resultado',
  'inspect': 'Inspeccionar',
  'action.tabs': 'Ver pestañas',
  'action.open': 'Abrir página',
  'action.navigate': 'Navegar',
  'action.snapshot': 'Leer página',
  'action.click': 'Hacer clic en elemento',
  'action.type': 'Escribir texto',
  'action.press': 'Pulsar tecla',
  'action.scroll': 'Desplazar',
  'action.screenshot': 'Captura de pantalla',
} satisfies Record<BrowserToolsKey, string>

/** French dictionary. */
export const fr = {
  'title': 'Navigateur',
  'preparing': 'Préparation d’une action du navigateur',
  'running': 'Action du navigateur en cours',
  'failed': 'L’action du navigateur a échoué',
  'stopped': 'Arrêté',
  'output': 'Résultat',
  'inspect': 'Inspecter',
  'action.tabs': 'Lister les onglets',
  'action.open': 'Ouvrir la page',
  'action.navigate': 'Naviguer',
  'action.snapshot': 'Lire la page',
  'action.click': 'Cliquer sur l’élément',
  'action.type': 'Saisir du texte',
  'action.press': 'Appuyer sur une touche',
  'action.scroll': 'Faire défiler',
  'action.screenshot': 'Capture d’écran',
} satisfies Record<BrowserToolsKey, string>

/** German dictionary. */
export const de = {
  'title': 'Browser',
  'preparing': 'Browseraktion wird vorbereitet',
  'running': 'Browseraktion läuft',
  'failed': 'Browseraktion fehlgeschlagen',
  'stopped': 'Angehalten',
  'output': 'Ergebnis',
  'inspect': 'Untersuchen',
  'action.tabs': 'Tabs auflisten',
  'action.open': 'Seite öffnen',
  'action.navigate': 'Navigieren',
  'action.snapshot': 'Seite lesen',
  'action.click': 'Element anklicken',
  'action.type': 'Text eingeben',
  'action.press': 'Taste drücken',
  'action.scroll': 'Scrollen',
  'action.screenshot': 'Bildschirmfoto',
} satisfies Record<BrowserToolsKey, string>

/** Russian dictionary. */
export const ru = {
  'title': 'Браузер',
  'preparing': 'Подготовка действия в браузере',
  'running': 'Выполняется действие в браузере',
  'failed': 'Действие в браузере не выполнено',
  'stopped': 'Остановлено',
  'output': 'Результат',
  'inspect': 'Проверить',
  'action.tabs': 'Список вкладок',
  'action.open': 'Открыть страницу',
  'action.navigate': 'Переход',
  'action.snapshot': 'Чтение страницы',
  'action.click': 'Нажатие на элемент',
  'action.type': 'Ввод текста',
  'action.press': 'Нажатие клавиши',
  'action.scroll': 'Прокрутка',
  'action.screenshot': 'Снимок экрана',
} satisfies Record<BrowserToolsKey, string>

/** Portuguese dictionary. */
export const pt = {
  'title': 'Navegador',
  'preparing': 'Preparando uma ação do navegador',
  'running': 'Ação do navegador em andamento',
  'failed': 'A ação do navegador falhou',
  'stopped': 'Interrompido',
  'output': 'Resultado',
  'inspect': 'Inspecionar',
  'action.tabs': 'Listar abas',
  'action.open': 'Abrir página',
  'action.navigate': 'Navegar',
  'action.snapshot': 'Ler página',
  'action.click': 'Clicar no elemento',
  'action.type': 'Digitar texto',
  'action.press': 'Pressionar tecla',
  'action.scroll': 'Rolar',
  'action.screenshot': 'Captura de tela',
} satisfies Record<BrowserToolsKey, string>
