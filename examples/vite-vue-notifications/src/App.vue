<script setup lang="ts">
import { useAction, useCondition, useEvent } from '@triggery/vue';
import { ref } from 'vue';
import { messageTrigger } from './triggers/index.ts';

const enabled = ref(true);
useCondition(messageTrigger, 'settings', () => ({ notifications: enabled.value }));

const fire = useEvent(messageTrigger, 'new-message');

interface Toast {
  id: string;
  title: string;
  body: string;
}
const toasts = ref<Toast[]>([]);
useAction(messageTrigger, 'showToast', (payload) => {
  toasts.value = [{ id: crypto.randomUUID(), ...payload }, ...toasts.value].slice(0, 5);
});
</script>

<template>
  <main style="font-family: system-ui, sans-serif; padding: 24px; max-width: 520px; margin: 0 auto;">
    <h1>Triggery — notifications (Vue)</h1>
    <label style="display: block; margin: 8px 0;">
      <input type="checkbox" v-model="enabled" /> Show toasts
    </label>
    <button type="button" @click="fire({ author: 'Alice', text: 'hi from Vue' })">
      Send message
    </button>
    <ul style="list-style: none; padding: 0; margin-top: 16px;">
      <li
        v-for="t in toasts"
        :key="t.id"
        style="padding: 8px; margin-bottom: 4px; background: #f7f7f7; border-radius: 6px;"
      >
        <strong>{{ t.title }}</strong>: {{ t.body }}
      </li>
    </ul>
  </main>
</template>
