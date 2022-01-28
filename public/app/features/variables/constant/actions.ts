import { validateVariableSelectionState } from '../state/actions';
import { ThunkResult } from 'app/types';
import { createConstantOptionsFromQuery } from './reducer';
import { DashboardVariableIdentifier } from '../state/types';
import { toUidAction } from '../state/dashboardVariablesReducer';
import { toVariablePayload } from '../utils';

export const updateConstantVariableOptions = (identifier: DashboardVariableIdentifier): ThunkResult<void> => {
  return async (dispatch) => {
    const { dashboardUid: uid } = identifier;
    await dispatch(toUidAction(uid, createConstantOptionsFromQuery(toVariablePayload(identifier))));
    await dispatch(validateVariableSelectionState(identifier));
  };
};
