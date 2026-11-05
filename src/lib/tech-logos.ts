// Logos of the technologies, one single look everywhere: monochrome SVG files kept in /public/tech (the simple-icons set,
// CC0), painted in the text colour by the page. They replace the pictures uploaded with each skill in the admin (JPG with a
// white background, screenshots, stock images), which never matched each other.

/** What a technology is called once reduced to letters and digits → the file in /public/tech (without ".svg") */
const FILES: Record<string, string> = {
  react: 'react',
  nextjs: 'nextdotjs',
  next: 'nextdotjs',
  typescript: 'typescript',
  javascript: 'javascript',
  html: 'html5',
  css: 'css3',
  tailwind: 'tailwindcss',
  tailwindcss: 'tailwindcss',
  framermotion: 'framer',
  angular: 'angular',
  bootstrap: 'bootstrap',
  boostrap: 'bootstrap', // spelling found in the data; the logo is the right one anyway
  flutter: 'flutter',
  kotlin: 'kotlin',
  nodejs: 'nodedotjs',
  node: 'nodedotjs',
  express: 'express',
  laravel: 'laravel',
  php: 'php',
  python: 'python',
  postgresql: 'postgresql',
  postgres: 'postgresql',
  mysql: 'mysql',
  mongodb: 'mongodb',
  redis: 'redis',
  graphql: 'graphql',
  restgraphql: 'graphql',
  docker: 'docker',
  kubernetes: 'kubernetes',
  githubactions: 'githubactions',
  terraform: 'terraform',
  vercel: 'vercel',
  awsvercel: 'vercel',
  aws: 'amazonwebservices',
  git: 'git',
  github: 'github',
  linux: 'linux',
  nginx: 'nginx',
  prometheus: 'prometheus',
  grafana: 'grafana',
  postman: 'postman',
}

/** The logo file for a technology's name ("Next.js", "next js", "NEXT.JS"…), or null when there is none */
export function techLogo(name: string): string | null {
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const file = FILES[key]
  return file ? `/tech/${file}.svg` : null
}
