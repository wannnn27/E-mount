<!--
  SkeletonTable.vue
  Loading placeholder untuk tabel manifest harian ranger.
  Custom scrollbar + shimmer rows.
-->
<script setup lang="ts">
defineProps<{
  rows?: number
  columns?: number
}>()

withDefaults(defineProps<{ rows?: number; columns?: number }>(), {
  rows: 8,
  columns: 6
})
</script>

<template>
  <div class="table-responsive custom-scroll">
    <table class="skeleton-table" aria-hidden="true">
      <!-- Header skeleton -->
      <thead>
        <tr>
          <th v-for="c in columns" :key="c">
            <div class="skeleton skeleton-text sm" :style="{ width: c === 1 ? '40px' : '90px' }"></div>
          </th>
        </tr>
      </thead>

      <!-- Row skeletons -->
      <tbody>
        <tr v-for="r in rows" :key="r" class="skeleton-row" :style="{ animationDelay: `${r * 0.05}s` }">
          <td v-for="c in columns" :key="c">
            <div
              class="skeleton skeleton-text"
              :style="{
                width: c === 1 ? '36px' : c === columns ? '80px' : `${60 + (r * c * 17) % 40}%`
              }"
            ></div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.skeleton-table {
  width: 100%;
  min-width: 700px;
  border-collapse: collapse;
}

.skeleton-table th,
.skeleton-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border-light);
}

.skeleton-table thead {
  background: var(--bg-light);
}

.skeleton-row {
  animation: rowFadeIn 0.4s ease forwards;
  opacity: 0;
}

@keyframes rowFadeIn {
  to { opacity: 1; }
}
</style>
