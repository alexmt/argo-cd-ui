import { FormField, getNestedField } from 'argo-ui';
import * as React from 'react';
import { FormApi, Text } from 'react-form';

import { EditablePanel } from '../../../shared/components';
import * as models from '../../../shared/models';

import { getParamsWithOverridesInfo } from '../utils';

const jsonDiffPatch = require('jsondiffpatch');

export const ParametersPanel = (props: { app: models.Application, updateApp: (app: models.Application) => Promise<any>}) => {
    const componentParams = getParamsWithOverridesInfo(props.app.status.parameters || [], props.app.spec.source.componentParameterOverrides);

    const src: any = {};
    Array.from(componentParams.keys()).forEach((component) => {
        const componentSrc: any = {};
        componentParams.get(component).forEach((item) => componentSrc[item.name] = item.value);
        src[component] = componentSrc;
    });

    const items = Array.from(componentParams.keys()).
        map((component) => componentParams.get(component).map((item, i) => ({...item, needBefore: i === 0, component}))).reduce((first, second) => first.concat(second), []).
        map((param) => ({
            title: param.name,
            key: param.name + param.component,
            before: param.needBefore && <p>{param.component}</p>,
            view: (
                <span title={param.value}>
                    {param.original && <span className='fa fa-exclamation-triangle' title={`Original value: ${param.original}`}/>} {param.value}
                </span>
            ),
            edit: (formApi: FormApi) => {
                const labelStyle = {position: 'absolute', right: 0, top: 0, zIndex: 1} as any;
                const overrideRemoved = getNestedField(formApi.values, `${param.component}.${param.name}`) === null;

                return (
                    <React.Fragment>
                        {overrideRemoved && (
                            <span>{param.original}</span>
                        ) || <FormField formApi={formApi} field={`${param.component}.${param.name}`} component={Text}/>}
                        {param.original && !overrideRemoved && <a onClick={() => formApi.setValue(`${param.component}.${param.name}`, null)} style={labelStyle}>
                            Remove override</a>}
                        {overrideRemoved && <a onClick={() => formApi.setValue(`${param.component}.${param.name}`, param.value)} style={labelStyle}>
                            Keep override</a>}
                    </React.Fragment>
                );
            },
        }));
    return items.length === 0 && (
        <div className='white-box'>
            <p>Application has no parameters</p>
        </div>
    ) || (
        <EditablePanel save={async (params) => {
            const diff = jsonDiffPatch.diff(src, params) as {[name: string]: {[name: string]: string[]}} || {};
            const overrides = Object.keys(diff).map((component) => Object.keys(diff[component]).map((key) => ({
                component,
                name: key,
                value: diff[component][key][1],
            }))).reduce((first, second) => first.concat(second), []);

            if (overrides.length > 0) {
                const updatedApp = JSON.parse(JSON.stringify(props.app)) as models.Application;
                updatedApp.spec.source.componentParameterOverrides = (updatedApp.spec.source.componentParameterOverrides || []);
                overrides.forEach((override) => {
                    const index = updatedApp.spec.source.componentParameterOverrides.findIndex((item) => item.name === override.name && item.component === override.component);
                    if (index > -1) {
                        if (override.value === null) {
                            updatedApp.spec.source.componentParameterOverrides.splice(index, 1);
                        } else {
                            updatedApp.spec.source.componentParameterOverrides[index].value = override.value;
                        }
                    } else {
                        updatedApp.spec.source.componentParameterOverrides.push(override);
                    }
                });

                props.updateApp(updatedApp);
            }
        }} values={src} items={items}/>
    );
};
