import { watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

/** Consume the selected record once so selecting it again reopens a closed drawer. */
export function useSearchRecord(path: string, open: (id: string) => void) {
  const route = useRoute();
  const router = useRouter();
  watch(() => route.query.searchId, (id) => {
    if (route.path !== path || typeof id !== 'string' || !/^[1-9]\d*$/.test(id)) return;
    open(id);
    const { searchId, ...query } = route.query;
    void router.replace({ path, query, hash: route.hash });
  }, { immediate: true });
}
