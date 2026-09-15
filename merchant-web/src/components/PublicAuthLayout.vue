<script setup lang="ts">
import mtripLogo from '@/assets/login/mtrip-logo.png';
import worldMapBackground from '@/assets/login/world-map-background.jpeg';

defineProps<{ eyebrow: string; title: string; subtitle: string }>();
</script>

<template>
  <div class="auth-page">
    <header class="auth-header"><span class="auth-logo"><img :src="mtripLogo" alt="mTrip" /></span></header>
    <main class="auth-main" :style="{ backgroundImage: `url(${worldMapBackground})` }">
      <article class="auth-card">
        <header class="auth-card-header">
          <span>{{ eyebrow }}</span>
          <h1>{{ title }}</h1>
          <p>{{ subtitle }}</p>
        </header>
        <div class="auth-body">
          <section class="auth-content"><slot /></section>
          <aside class="auth-aside"><slot name="aside" /></aside>
        </div>
      </article>
    </main>
    <footer class="auth-footer"><slot name="footer" /></footer>
  </div>
</template>

<style scoped lang="less">
.auth-page { display: flex; min-height: 100%; flex-direction: column; background: #f7f8fa; color: #14213d; }
.auth-header { z-index: 1; display: flex; min-height: 55px; align-items: center; justify-content: center; border-bottom: 1px solid #bfc9de; background: linear-gradient(90deg, #1747b9, #2463eb 55%, #0d9488); }
.auth-logo { position: relative; display: block; width: 68px; height: 42px; overflow: hidden; img { position: absolute; top: -72.73%; left: -40.3%; width: 180.6%; height: 245.45%; max-width: none; } }
.auth-main { position: relative; display: flex; flex: 1 1 auto; align-items: center; justify-content: center; padding: 36px 32px; background-position: center; background-repeat: repeat; background-size: 512px 279px; &::before { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(247,248,250,.58), rgba(226,237,255,.72)); content: ''; } }
.auth-card { position: relative; width: min(980px, 100%); overflow: hidden; border: 1px solid #dbe4f0; border-radius: 14px; background: #fff; box-shadow: 0 18px 50px rgba(21,44,91,.12); }
.auth-card-header { padding: 22px 40px; border-bottom: 1px solid #dbe4f0; background: linear-gradient(105deg, #eef4ff, #effcf9); text-align: center; > span { color: #0d9488; font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; } h1 { margin: 3px 0 2px; font-family: 'Space Grotesk', 'Plus Jakarta Sans', sans-serif; font-size: 30px; line-height: 38px; } p { margin: 0; color: #64748b; font-size: 14px; } }
.auth-body { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(290px, .8fr); gap: 36px; padding: 36px 40px; }
.auth-content { min-width: 0; }
.auth-aside { display: flex; min-width: 0; align-items: stretch; }
.auth-footer { display: flex; min-height: 64px; align-items: center; justify-content: center; padding: 0 32px; border-top: 1px solid #dbe4f0; background: #eef4ff; color: #52637a; font-size: 12px; }
@media (max-width: 760px) { .auth-main { align-items: flex-start; padding: 22px 14px; } .auth-card-header { padding: 20px; h1 { font-size: 25px; } } .auth-body { grid-template-columns: 1fr; gap: 24px; padding: 24px 20px; } .auth-footer { min-height: 56px; } }
</style>
