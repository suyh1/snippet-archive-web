<script setup lang="ts">
const frontendStack = [
  'Vue 3',
  'TypeScript',
  'Pinia',
  'Vite',
  'Reka UI',
  'Tailwind CSS v4',
  'Motion for Vue',
  'CodeMirror 6',
]

const backendStack = [
  'Node.js',
  'Fastify',
  'TypeScript',
  'Prisma',
  'PostgreSQL',
]
</script>

<template>
  <main class="page">
    <section class="card">
      <h1>Snippet Archive Web</h1>
      <p>非 uTools 版本项目已经初始化完成。</p>

      <h2>前端技术栈（与原项目一致）</h2>
      <ul>
        <li v-for="item in frontendStack" :key="item">{{ item }}</li>
      </ul>

      <h2>后端与数据库</h2>
      <ul>
        <li v-for="item in backendStack" :key="item">{{ item }}</li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.card {
  width: min(860px, 100%);
  background: white;
  border-radius: 20px;
  border: 1px solid #dbe1ea;
  padding: 24px;
}

h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

h2 {
  margin: 20px 0 8px;
  font-size: 18px;
}

p, li {
  color: #334155;
  line-height: 1.6;
}

ul {
  padding-left: 18px;
}
</style>
