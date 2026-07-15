<!--
  SkeletonCard.vue
  Loading placeholder untuk kartu jalur/gunung.
  Menampilkan shimmer animation saat data belum tersedia.
-->
<script setup lang="ts">
withDefaults(defineProps<{
  /** Berapa kartu skeleton yang ditampilkan */
  count?: number
}>(), { count: 3 })
</script>

<template>
  <div class="grid grid-3">
    <div
      v-for="i in count"
      :key="i"
      class="card-tngm skeleton-card"
      aria-hidden="true"
    >
      <!-- Skeleton Image -->
      <div class="skeleton skeleton-img"></div>

      <!-- Skeleton Body -->
      <div class="card-tngm-body">
        <div class="skeleton skeleton-text lg" style="width: 80%;"></div>
        <div class="skeleton skeleton-text sm" style="width: 50%; margin-bottom: 1rem;"></div>

        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
          <div class="skeleton skeleton-badge"></div>
          <div class="skeleton skeleton-badge" style="width: 60px;"></div>
        </div>

        <div class="card-tngm-footer">
          <div class="skeleton skeleton-btn"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skeleton-card {
  pointer-events: none;
  user-select: none;
}

.card-tngm-body {
  padding: 1.25rem;
}
</style>
