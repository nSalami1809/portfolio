import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiBrain01Icon, Add01Icon, AlertCircleIcon, ApiIcon, Award01Icon, BankIcon, BookOpen01Icon, Briefcase01Icon, Building03Icon, Calendar03Icon,
  Call02Icon, Cancel01Icon, CancelCircleIcon, CheckmarkCircle02Icon, Clock01Icon, CloudBackupIcon, CodeIcon, ComputerTerminal01Icon, Copy01Icon, CpuIcon,
  CreditCardIcon, CustomerService01Icon, Database01Icon, DeliveryBox01Icon, Download01Icon, Facebook01Icon, File02Icon, FingerPrintIcon, FlaskConicalIcon, FolderCodeIcon,
  GlobeIcon, GraduationScrollIcon, GridViewIcon, Github01Icon, HandshakeIcon, HeartIcon, Idea01Icon, InformationCircleIcon, InstagramIcon, Invoice01Icon,
  Layers01Icon, Layout01Icon, LanguageSkillIcon, LinkSquare02Icon, Linkedin01Icon, Location01Icon, LockPasswordIcon, Mail01Icon, Mouse01Icon, Package01Icon,
  Pen01Icon, PlugSocketIcon, RocketIcon, RssIcon, Search01Icon, SentIcon, ServerStack01Icon, Settings02Icon, Share08Icon, Shield01Icon,
  SignatureIcon, SmartPhone01Icon, Store01Icon, Tag01Icon, Target01Icon, Tick02Icon, Upload01Icon, UserIcon, Wallet01Icon, WebDesign01Icon,
  WhatsappIcon, Wrench01Icon, ComputerSettingsIcon, FolderCheckIcon, DashboardSquare01Icon, Home01Icon, Edit02Icon, Image01Icon, Video01Icon, TaskDone01Icon, RefreshIcon,
  Chat01Icon, Notification01Icon, Mic01Icon, StopIcon, ArrowUp02Icon, PinIcon, Menu01Icon, ReceiptDollarIcon, MailRemove01Icon, UserMultiple02Icon, QuoteDownIcon, ChartLineData01Icon, Logout01Icon, Moon02Icon, Sun01Icon, ViewIcon, ViewOffIcon, Delete02Icon, ThumbsUpIcon, PlayIcon, PauseIcon, ArrowDown01Icon, ArrowLeft01Icon, ArrowLeft02Icon, ArrowRight01Icon, ArrowRight02Icon, ArrowUp01Icon, ArrowUpRight01Icon, StarIcon,
} from '@hugeicons/core-free-icons'

// The site's icon set: Hugeicons (free pack), thin rounded line icons, one weight everywhere.
// Pages ask for an icon by NAME; only the icons listed here are bundled (no `import *`).
const ICONS = {
  // direction
  arrowRight: ArrowRight02Icon, arrowLeft: ArrowLeft02Icon, chevronRight: ArrowRight01Icon, chevronLeft: ArrowLeft01Icon, chevronDown: ArrowDown01Icon, chevronUp: ArrowUp01Icon, arrowUpRight: ArrowUpRight01Icon,
  // actions
  check: Tick02Icon, close: Cancel01Icon, closeCircle: CancelCircleIcon, add: Add01Icon, copy: Copy01Icon, share: Share08Icon, upload: Upload01Icon, download: Download01Icon, externalLink: LinkSquare02Icon, search: Search01Icon, send: SentIcon, rss: RssIcon,
  // status
  success: CheckmarkCircle02Icon, alert: AlertCircleIcon, info: InformationCircleIcon,
  // contact and brands
  mail: Mail01Icon, phone: Call02Icon, location: Location01Icon, whatsapp: WhatsappIcon, github: Github01Icon, linkedin: Linkedin01Icon, facebook: Facebook01Icon, instagram: InstagramIcon, user: UserIcon,
  // navigation
  about: FingerPrintIcon, experience: Briefcase01Icon, vision: Idea01Icon, projects: FolderCodeIcon, work: HandshakeIcon, blog: BookOpen01Icon, documents: File02Icon, lab: ComputerTerminal01Icon, tag: Tag01Icon, cpu: CpuIcon,
  // what the work is made of
  store: Store01Icon, phoneApp: SmartPhone01Icon, building: Building03Icon, bank: BankIcon, wallet: Wallet01Icon, grid: GridViewIcon, flask: FlaskConicalIcon, card: CreditCardIcon,
  calendar: Calendar03Icon, clock: Clock01Icon, rocket: RocketIcon, code: CodeIcon, server: ServerStack01Icon, database: Database01Icon, cloud: CloudBackupIcon, wrench: Wrench01Icon, settings: Settings02Icon,
  graduation: GraduationScrollIcon, globe: GlobeIcon, language: LanguageSkillIcon, shield: Shield01Icon, lock: LockPasswordIcon, layout: Layout01Icon, webDesign: WebDesign01Icon, pen: Pen01Icon, signature: SignatureIcon,
  invoice: Invoice01Icon, package: Package01Icon, delivery: DeliveryBox01Icon, target: Target01Icon, layers: Layers01Icon, award: Award01Icon, api: ApiIcon, plug: PlugSocketIcon, support: CustomerService01Icon,
  devTools: ComputerSettingsIcon, projectDone: FolderCheckIcon,
  heart: HeartIcon, star: StarIcon, ai: AiBrain01Icon, mouse: Mouse01Icon,
  // back-office
  dashboard: DashboardSquare01Icon, home: Home01Icon, edit: Edit02Icon, image: Image01Icon, video: Video01Icon, taskDone: TaskDone01Icon, refresh: RefreshIcon, chat: Chat01Icon, bell: Notification01Icon,
  mic: Mic01Icon, stop: StopIcon, arrowUp: ArrowUp02Icon, pin: PinIcon, menu: Menu01Icon, receipt: ReceiptDollarIcon, mailError: MailRemove01Icon, users: UserMultiple02Icon, quote: QuoteDownIcon, chart: ChartLineData01Icon, logout: Logout01Icon,
  // interface
  moon: Moon02Icon, sun: Sun01Icon, eye: ViewIcon, eyeOff: ViewOffIcon, trash: Delete02Icon, thumbsUp: ThumbsUpIcon, play: PlayIcon, pause: PauseIcon,
} as const

export type IconName = keyof typeof ICONS

/** Every icon the site can draw (for tests and pickers). */
export const ICON_NAMES = Object.keys(ICONS) as IconName[]

/** Which icon says what an offer, a step or a category is about, from its own words. Falls back on `fallback`. */
export function iconForText(text: string, fallback: IconName = 'layers'): IconName {
  const t = text.toLowerCase()
  const rules: Array<[RegExp, IconName]> = [
    // skills categories
    [/front-?end/, 'layout'],
    [/back-?end/, 'server'],
    [/outils|tools|tooling/, 'devTools'],
    // steps of a project
    [/devis|quote|estimat/, 'invoice'],
    [/signature|\bsign/, 'signature'],
    [/acompte|deposit|démarrage|kick-?off/, 'wallet'],
    [/développement|developpement|development|révision|revision/, 'code'],
    [/livraison|recette|delivery|acceptance/, 'delivery'],
    [/solde|reçu|receipt|balance|garantie|warranty/, 'shield'],
    [/boutique|e-?commerce|catalogue|shop/, 'store'],
    [/paiement|payment|mobile money|carte/, 'card'],
    [/authentification|sécurit|securit|auth\b|permission|login/, 'lock'],
    [/multilingue|langue|i18n|traduction/, 'language'],
    [/héberg|heberg|ci-?cd|déploiement|deploiement|docker|cloud|devops|infrastructure/, 'cloud'],
    [/maintenance|support|évolution|evolution/, 'wrench'],
    [/formation|prise en main|training/, 'graduation'],
    [/api|backend|serveur|server/, 'api'],
    [/mobile|application mobile|android|ios/, 'phoneApp'],
    [/application|logiciel|sur mesure|dashboard|tableau de bord|web app/, 'layout'],
    [/vitrine|site|landing|portfolio|pages?\b/, 'webDesign'],
    [/design|ui|ux|maquette/, 'pen'],
    [/base de données|database|données|data/, 'database'],
    [/ia\b|intelligence|chatbot|assistant/, 'ai'],
  ]
  return rules.find(([re]) => re.test(t))?.[1] ?? fallback
}

interface Props {
  name: IconName
  size?: number
  /** Line weight; thinner by default on large icons, a touch heavier on small ones so they stay legible. */
  strokeWidth?: number
  className?: string
  style?: React.CSSProperties
}

export default function Icon({ name, size = 16, strokeWidth, className, style }: Props) {
  return (
    <HugeiconsIcon
      icon={ICONS[name]}
      size={size}
      strokeWidth={strokeWidth ?? (size <= 16 ? 1.9 : size <= 20 ? 1.7 : 1.5)}
      className={className}
      style={style}
      aria-hidden="true"
    />
  )
}
