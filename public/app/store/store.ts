import { Store } from 'redux';

import { initialDashboardVariablesState } from 'app/features/variables/state/dashboardVariablesReducer';
import { StoreState } from 'app/types';

export let store: Store<StoreState>;

export function setStore(newStore: Store<StoreState>) {
  store = newStore;
}

export function getState(): StoreState {
  if (!store || !store.getState) {
    return { dashboardVariables: { ...initialDashboardVariablesState, lastUid: 'uid' } } as StoreState; // used by tests
  }

  return store.getState();
}

export function dispatch(action: any) {
  if (!store || !store.getState) {
    return;
  }

  return store.dispatch(action);
}
