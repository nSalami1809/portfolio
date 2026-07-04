import type { PersonalInfo, Project, Experience, Education, Skill, Testimonial, SiteSettings, SocialLinks, VisionData, BlogPost } from '@/types'

export const defaultPersonalInfo: PersonalInfo = {
  name: 'Nawaf Nemrod Salami',
  role: 'Développeur Web Fullstack & DevOps',
  bio: 'Je conçois et déploie des applications web modernes, de l\'interface utilisateur jusqu\'à l\'infrastructure cloud. Passionné par les systèmes robustes et les expériences élégantes.',
  email: 'nemrodsalami1809@gmail.com',
  location: 'Libreville, Gabon — Disponible en remote',
  photo: '',
}

export const defaultSocials: SocialLinks = {
  linkedin: '',
  github: '',
  facebook: '',
  instagram: '',
}

export const defaultProjects: Project[] = [
  {
    slug: 'portfolio-personnel',
    title: 'Portfolio Personnel',
    description: 'Site portfolio fullstack avec Next.js, Tailwind CSS et Framer Motion.',
    longDescription: 'Conception et développement de mon portfolio personnel, vitrine de mes compétences en développement web fullstack et DevOps. Architecture Next.js 14 App Router, animations Framer Motion, déploiement Vercel.',
    category: 'Web',
    tags: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Framer Motion', 'Vercel'],
    year: '2025',
    status: 'completed',
    githubUrl: '',
    liveUrl: '',
    image: '',
  },
  {
    slug: 'devops-pipeline',
    title: 'Pipeline CI/CD Automatisé',
    description: 'Mise en place d\'un pipeline CI/CD complet avec GitHub Actions, Docker et Kubernetes.',
    longDescription: 'Architecture complète de déploiement continu : containerisation Docker multi-stage, orchestration Kubernetes, monitoring Prometheus/Grafana.',
    category: 'DevOps',
    tags: ['Docker', 'Kubernetes', 'GitHub Actions', 'Terraform', 'Prometheus'],
    year: '2024',
    status: 'completed',
    githubUrl: '',
    liveUrl: '',
    image: '',
  },
  {
    slug: 'api-rest-node',
    title: 'API REST Node.js',
    description: 'API RESTful scalable avec authentification JWT, rate limiting et documentation Swagger.',
    longDescription: 'Développement d\'une API REST robuste : Express.js, PostgreSQL, authentification JWT, tests unitaires Jest, documentation Swagger.',
    category: 'Backend',
    tags: ['Node.js', 'Express', 'PostgreSQL', 'JWT', 'Jest'],
    year: '2024',
    status: 'completed',
    githubUrl: '',
    liveUrl: '',
    image: '',
  },
  {
    slug: 'dashboard-analytics',
    title: 'Dashboard Analytics',
    description: 'Interface de visualisation de données en temps réel avec React et Chart.js.',
    longDescription: 'Dashboard interactif pour la visualisation de métriques business : graphiques dynamiques, websockets pour le temps réel, filtres avancés.',
    category: 'Frontend',
    tags: ['React', 'TypeScript', 'Chart.js', 'WebSockets'],
    year: '2023',
    status: 'completed',
    githubUrl: '',
    liveUrl: '',
    image: '',
  },
]

export const defaultExperiences: Experience[] = [
  {
    id: '1',
    period: '2024 — Présent',
    role: 'Développeur Fullstack & DevOps',
    company: 'Freelance',
    description: 'Conception et déploiement d\'applications web complètes pour des clients variés. Architecture Next.js, APIs Node.js, pipelines CI/CD avec GitHub Actions et Docker.',
    tags: ['Next.js', 'Node.js', 'Docker', 'GitHub Actions', 'Vercel'],
  },
  {
    id: '2',
    period: '2023 — 2024',
    role: 'Développeur Web Fullstack',
    company: 'Projets personnels & montée en compétences',
    description: 'Montée en compétences sur l\'écosystème DevOps : conteneurisation, orchestration Kubernetes, infrastructure as code avec Terraform, monitoring Prometheus/Grafana.',
    tags: ['Kubernetes', 'Terraform', 'Prometheus', 'Grafana', 'AWS'],
  },
  {
    id: '3',
    period: '2022 — 2023',
    role: 'Développeur Frontend',
    company: 'Premiers projets & stage',
    description: 'Développement d\'interfaces React, intégration d\'APIs REST, mise en place de tests unitaires, premières expériences de déploiement continu.',
    tags: ['React', 'TypeScript', 'REST API', 'Jest', 'Git'],
  },
]

export const defaultEducations: Education[] = [
  {
    id: '1',
    year: '2022 — 2024',
    degree: 'Formation Développement Web & DevOps',
    school: 'Autodidacte & certifications en ligne',
    detail: 'AWS Cloud Practitioner, Docker & Kubernetes, Next.js Mastery',
  },
  {
    id: '2',
    year: '2021 — 2022',
    degree: 'Initiation à la programmation web',
    school: 'Formation initiale',
    detail: 'HTML, CSS, JavaScript, bases algorithmiques',
  },
]

export const defaultSkills: Skill[] = [
  { id: '1', category: 'Frontend', items: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Framer Motion'] },
  { id: '2', category: 'Backend', items: ['Node.js', 'Express', 'PostgreSQL', 'MongoDB', 'REST / GraphQL'] },
  { id: '3', category: 'DevOps & Cloud', items: ['Docker', 'Kubernetes', 'GitHub Actions', 'Terraform', 'AWS / Vercel'] },
  { id: '4', category: 'Outils', items: ['Git', 'Linux', 'Nginx', 'Prometheus', 'Grafana'] },
]

export const defaultTestimonials: Testimonial[] = []

export const defaultSettings: SiteSettings = {
  defaultTheme: 'dark',
  accentColor: '#8B5CF6',
  favicon: '',
  logo: '',
}

export const defaultVision: VisionData = {
  quote: "Un bon code n'est pas celui qui fonctionne — c'est celui qu'un autre développeur peut comprendre, modifier et déployer à 3h du matin en production sans stress.",
  philosophie: [
    "Ma vision du développement est profondément systémique. Je ne crois pas qu'il existe une ligne de démarcation nette entre le code applicatif et l'infrastructure qui le fait vivre. Les meilleurs produits que j'ai construits sont ceux où ces deux mondes ont été pensés ensemble, dès le départ.",
    "Le DevOps n'est pas une discipline technique — c'est une mentalité. C'est l'idée que l'on ne livre pas seulement une feature, on livre un système. Un système qui monitore, qui alerte, qui se remet de ses pannes, qui évolue sans friction.",
    "Sur le volet frontend, je suis convaincu que la performance et l'élégance ne s'opposent pas. Une interface rapide peut être belle. Un composant bien conçu peut être à la fois accessible, animé et maintenable.",
  ],
  approche: [
    "Je commence toujours par comprendre le problème avant d'écrire une ligne de code. Cette étape, souvent négligée, est pourtant celle qui détermine si l'on va construire la bonne chose ou juste la chose correctement.",
    "J'adopte une approche itérative : livrer tôt, mesurer, ajuster. Non pas parce que c'est à la mode, mais parce que les hypothèses de départ sont presque toujours partiellement fausses. La capacité à corriger le tir rapidement est une compétence autant technique qu'organisationnelle.",
    "La documentation, les tests, l'observabilité — ce sont des actes de respect envers les personnes qui travailleront avec ce code demain.",
  ],
  valeurs: [
    { title: 'Clarté', text: "Un système simple bien compris vaut toujours mieux qu'une architecture brillante que personne ne maîtrise." },
    { title: 'Fiabilité', text: "Le code qui dort en production doit mériter ce sommeil. Chaque déploiement est un engagement de disponibilité." },
    { title: 'Curiosité', text: "Rester curieux n'est pas optionnel — c'est la condition pour rester pertinent dans un écosystème en mouvement permanent." },
  ],
}

export const defaultBlogPosts: BlogPost[] = []

