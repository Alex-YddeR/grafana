import { Subscription } from 'rxjs';
import { getDataSourceSrv, toDataQueryError } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/data';

import { updateOptions } from '../state/actions';
import { QueryVariableModel } from '../types';
import { ThunkResult } from '../../../types';
import { getDashboardVariable, getDashboardVariablesState } from '../state/selectors';
import {
  addVariableEditorError,
  changeVariableEditorExtended,
  removeVariableEditorError,
  VariableEditorState,
} from '../editor/reducer';
import { changeVariableProp } from '../state/sharedReducer';
import { DashboardVariableIdentifier } from '../state/types';
import { getVariableQueryEditor } from '../editor/getVariableQueryEditor';
import { getVariableQueryRunner } from './VariableQueryRunner';
import { variableQueryObserver } from './variableQueryObserver';
import { QueryVariableEditorState } from './reducer';
import { hasOngoingTransaction, toDashboardVariableIdentifier, toVariablePayload } from '../utils';
import { toUidAction } from '../state/dashboardVariablesReducer';

export const updateQueryVariableOptions = (
  identifier: DashboardVariableIdentifier,
  searchFilter?: string
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    try {
      const { dashboardUid: uid } = identifier;
      if (!hasOngoingTransaction(uid, getState())) {
        // we might have cancelled a batch so then variable state is removed
        return;
      }

      const variableInState = getDashboardVariable<QueryVariableModel>(identifier, getState());
      if (getDashboardVariablesState(uid, getState()).editor.id === variableInState.id) {
        dispatch(toUidAction(uid, removeVariableEditorError({ errorProp: 'update' })));
      }
      const datasource = await getDataSourceSrv().get(variableInState.datasource ?? '');

      // We need to await the result from variableQueryRunner before moving on otherwise variables dependent on this
      // variable will have the wrong current value as input
      await new Promise((resolve, reject) => {
        const subscription: Subscription = new Subscription();
        const observer = variableQueryObserver(resolve, reject, subscription);
        const responseSubscription = getVariableQueryRunner().getResponse(identifier).subscribe(observer);
        subscription.add(responseSubscription);

        getVariableQueryRunner().queueRequest({ identifier, datasource, searchFilter });
      });
    } catch (err) {
      const error = toDataQueryError(err);
      const { dashboardUid: uid } = identifier;
      if (getDashboardVariablesState(uid, getState()).editor.id === identifier.id) {
        dispatch(toUidAction(uid, addVariableEditorError({ errorProp: 'update', errorText: error.message })));
      }

      throw error;
    }
  };
};

export const initQueryVariableEditor = (identifier: DashboardVariableIdentifier): ThunkResult<void> => async (
  dispatch,
  getState
) => {
  const variable = getDashboardVariable<QueryVariableModel>(identifier, getState());
  await dispatch(changeQueryVariableDataSource(toDashboardVariableIdentifier(variable), variable.datasource));
};

export const changeQueryVariableDataSource = (
  identifier: DashboardVariableIdentifier,
  name: DataSourceRef | null
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    try {
      const { dashboardUid: uid } = identifier;
      const state = getDashboardVariablesState(uid, getState()).editor as VariableEditorState<QueryVariableEditorState>;
      const previousDatasource = state.extended?.dataSource;
      const dataSource = await getDataSourceSrv().get(name ?? '');
      if (previousDatasource && previousDatasource.type !== dataSource?.type) {
        dispatch(
          toUidAction(uid, changeVariableProp(toVariablePayload(identifier, { propName: 'query', propValue: '' })))
        );
      }
      dispatch(toUidAction(uid, changeVariableEditorExtended({ propName: 'dataSource', propValue: dataSource })));

      const VariableQueryEditor = await getVariableQueryEditor(dataSource);
      dispatch(
        toUidAction(
          uid,
          changeVariableEditorExtended({ propName: 'VariableQueryEditor', propValue: VariableQueryEditor })
        )
      );
    } catch (err) {
      console.error(err);
    }
  };
};

export const changeQueryVariableQuery = (
  identifier: DashboardVariableIdentifier,
  query: any,
  definition?: string
): ThunkResult<void> => async (dispatch, getState) => {
  const { dashboardUid: uid } = identifier;
  const variableInState = getDashboardVariable<QueryVariableModel>(identifier, getState());
  if (hasSelfReferencingQuery(variableInState.name, query)) {
    const errorText = 'Query cannot contain a reference to itself. Variable: $' + variableInState.name;
    dispatch(toUidAction(uid, addVariableEditorError({ errorProp: 'query', errorText })));
    return;
  }

  dispatch(toUidAction(uid, removeVariableEditorError({ errorProp: 'query' })));
  dispatch(
    toUidAction(uid, changeVariableProp(toVariablePayload(identifier, { propName: 'query', propValue: query })))
  );

  if (definition) {
    dispatch(
      toUidAction(
        uid,
        changeVariableProp(toVariablePayload(identifier, { propName: 'definition', propValue: definition }))
      )
    );
  } else if (typeof query === 'string') {
    dispatch(
      toUidAction(uid, changeVariableProp(toVariablePayload(identifier, { propName: 'definition', propValue: query })))
    );
  }

  await dispatch(updateOptions(identifier));
};

export function hasSelfReferencingQuery(name: string, query: any): boolean {
  if (typeof query === 'string' && query.match(new RegExp('\\$' + name + '(/| |$)'))) {
    return true;
  }

  const flattened = flattenQuery(query);

  for (let prop in flattened) {
    if (flattened.hasOwnProperty(prop)) {
      const value = flattened[prop];
      if (typeof value === 'string' && value.match(new RegExp('\\$' + name + '(/| |$)'))) {
        return true;
      }
    }
  }

  return false;
}

/*
 * Function that takes any object and flattens all props into one level deep object
 * */
export function flattenQuery(query: any): any {
  if (typeof query !== 'object') {
    return { query };
  }

  const keys = Object.keys(query);
  const flattened = keys.reduce((all, key) => {
    const value = query[key];
    if (typeof value !== 'object') {
      all[key] = value;
      return all;
    }

    const result = flattenQuery(value);
    for (let childProp in result) {
      if (result.hasOwnProperty(childProp)) {
        all[`${key}_${childProp}`] = result[childProp];
      }
    }

    return all;
  }, {} as Record<string, any>);

  return flattened;
}
