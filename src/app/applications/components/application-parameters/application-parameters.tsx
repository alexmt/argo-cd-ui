import { FormField, FormSelect, getNestedField } from 'argo-ui';
import * as React from 'react';
import { FieldApi, FormApi, FormField as ReactFormField, Text } from 'react-form';

import { CheckboxField, EditablePanel, EditablePanelItem, TagsInputField } from '../../../shared/components';
import * as models from '../../../shared/models';

const TextWithMetadataField = ReactFormField((props: {metadata: { value: string }, fieldApi: FieldApi, className: string }) => {
    const { fieldApi: {getValue, setValue}} = props;
    const metadata = (getValue() || props.metadata);

    return <input className={props.className} value={metadata.value} onChange={(el) => setValue({...metadata, value: el.target.value})}/>;
});

function distinct<T>(first: IterableIterator<T>, second: IterableIterator<T>) {
    return Array.from(new Set(Array.from(first).concat(Array.from(second))));
}

function overridesFirst(first: { overrideIndex: number}, second: { overrideIndex: number }) {
    if (first.overrideIndex < 0) {
        return 1;
    } else if (second.overrideIndex < 0) {
        return -1;
    }
    return first.overrideIndex - second.overrideIndex;
}

function getParamsEditableItems<T extends { name: string, value: string }>(
    fieldsPath: string,
    params: {
        key?: string;
        overrideIndex: number;
        original: string,
        metadata: { name: string; value: string; }
    }[],
) {
    return params.sort(overridesFirst).map((param, i) => ({
        key: param.key,
        title: param.metadata.name,
        view: (
            <span title={param.metadata.value}>
                {param.metadata.value !== param.original && <span className='fa fa-exclamation-triangle' title={`Original value: ${param.original}`}/>} {param.metadata.value}
            </span>
        ),
        edit: (formApi: FormApi) => {
            const labelStyle = {position: 'absolute', right: 0, top: 0, zIndex: 1} as any;
            const overrideRemoved =
                    getNestedField(formApi.values, fieldsPath) != null &&
                    getNestedField(formApi.values, fieldsPath)[i] === null;
            const fieldItemPath = `${fieldsPath}[${i}]`;
            return (
                <React.Fragment>
                    {overrideRemoved && (
                        <span>{param.original}</span>
                    ) || (
                        <FormField formApi={formApi} field={fieldItemPath} component={TextWithMetadataField} componentProps={{
                            metadata: param.metadata,
                        }}/>
                    )}
                    {param.metadata.value !== param.original && !overrideRemoved && <a onClick={() => formApi.setValue(fieldItemPath, null)} style={labelStyle}>
                        Remove override</a>}
                    {overrideRemoved && <a onClick={() => formApi.setValue(fieldItemPath, param.metadata)} style={labelStyle}>
                        Keep override</a>}
                </React.Fragment>
            );
        },
    })).sort((first, second) => {
        const firstSortBy = first.key || first.title;
        const secondSortBy = second.key || second.title;
        return firstSortBy.localeCompare(secondSortBy);
    }).map((item, i) => ({...item, before: i === 0 && <p style={{ marginTop: '1em' }}>PARAMETERS</p> || null }));
}

export const ApplicationParameters = (props: { application: models.Application, details: models.RepoAppDetails, save?: (application: models.Application) => Promise<any> }) => {
    const app = props.application;
    const source = props.application.spec.source;

    let attributes: EditablePanelItem[] = [];

    if (props.details.type === 'Ksonnet' && props.details.ksonnet) {
        attributes.push({
            title: 'ENVIRONMENT',
            view: app.spec.source.ksonnet && app.spec.source.ksonnet.environment,
            edit: (formApi: FormApi) => (
                <FormField
                    formApi={formApi}
                    field='spec.source.ksonnet.environment'
                    component={FormSelect}
                    componentProps={{ options: Object.keys(props.details.ksonnet.environments) }}/>
            ),
        });
        const paramsByComponentName = new Map<string, models.KsonnetParameter>();
        (props.details.ksonnet && props.details.ksonnet.parameters || []).forEach((param) => paramsByComponentName.set(`${param.component}-${param.name}` , param));
        const overridesByComponentName = new Map<string, number>();
        (source.ksonnet && source.ksonnet.parameters || []).forEach((override, i) => overridesByComponentName.set(`${override.component}-${override.name}`, i));
        attributes = attributes.concat(getParamsEditableItems('spec.source.ksonnet.parameters',
                distinct(paramsByComponentName.keys(), overridesByComponentName.keys()).map((componentName) => {
            const param = paramsByComponentName.get(componentName);
            const original = param && param.value || '';
            let overrideIndex = overridesByComponentName.get(componentName);
            if (overrideIndex === undefined) {
                overrideIndex = -1;
            }
            const value = overrideIndex > -1 && source.ksonnet.parameters[overrideIndex].value || original;
            return { key: componentName, overrideIndex, original, metadata: { name: param.name, component: param.component, value } };
        })));
    } else if (props.details.type === 'Kustomize' && props.details.kustomize) {
        attributes.push({
            title: 'NAME PREFIX',
            view: app.spec.source.kustomize && app.spec.source.kustomize.namePrefix,
            edit: (formApi: FormApi) => <FormField formApi={formApi} field='spec.source.kustomize.namePrefix' component={Text}/>,
        });
        const imagesByName = new Map<string, models.KustomizeImageTag>();
        (props.details.kustomize && props.details.kustomize.imageTags || []).forEach((img) => imagesByName.set(img.name, img));
        const overridesByName = new Map<string, number>();
        (source.kustomize && source.kustomize.imageTags || []).forEach((override, i) => overridesByName.set(override.name, i));
        attributes = attributes.concat(getParamsEditableItems('spec.source.kustomize.imageTags',
                distinct(imagesByName.keys(), overridesByName.keys()).map((name) => {
            const param = imagesByName.get(name);
            const original = param && param.value || '';
            let overrideIndex = overridesByName.get(name);
            if (overrideIndex === undefined) {
                overrideIndex = -1;
            }
            const value = overrideIndex > -1 && source.kustomize.imageTags[overrideIndex].value || original;
            return { overrideIndex, original, metadata: { name, value } };
        })));
    } else if (props.details.type === 'Helm' && props.details.helm) {
        attributes.push({
            title: 'VALUES FILES',
            view: app.spec.source.helm && (app.spec.source.helm.valueFiles || []).join(', ') || 'No values files selected',
            edit: (formApi: FormApi) => (
                <FormField formApi={formApi} field='spec.source.helm.valueFiles' component={TagsInputField} componentProps={{
                    options: props.details.helm.valueFiles,
                    noTagsLabel: 'No values files selected',
                }}/>
            ),
        });
        const paramsByName = new Map<string, models.HelmParameter>();
        (props.details.helm.parameters || []).forEach((param) => paramsByName.set(param.name, param));
        const overridesByName = new Map<string, number>();
        (source.helm && source.helm.parameters || []).forEach((override, i) => overridesByName.set(override.name, i));
        attributes = attributes.concat(getParamsEditableItems('spec.source.helm.parameters', distinct(paramsByName.keys(), overridesByName.keys()).map((name) => {
            const param = paramsByName.get(name);
            const original = param && param.value || '';
            let overrideIndex = overridesByName.get(name);
            if (overrideIndex === undefined) {
                overrideIndex = -1;
            }
            const value = overrideIndex > -1 && source.helm.parameters[overrideIndex].value || original;
            return { overrideIndex, original, metadata: { name, value } };
        })));
    } else if (props.details.type === 'Directory') {
        attributes.push({
            title: 'DIRECTORY RECURSE',
            view: (!!(app.spec.source.directory && app.spec.source.directory.recurse)).toString(),
            edit: (formApi: FormApi) => (
                <FormField formApi={formApi} field='spec.source.directory.recurse' component={CheckboxField}/>
            ),
        });
    }

    return (
        <EditablePanel
            save={props.save && (async (input: models.Application) => {
                if (input.spec.source.helm && input.spec.source.helm.parameters) {
                    input.spec.source.helm.parameters = input.spec.source.helm.parameters.filter((item) => item !== null);
                }
                if (input.spec.source.ksonnet && input.spec.source.ksonnet.parameters) {
                    input.spec.source.ksonnet.parameters = input.spec.source.ksonnet.parameters.filter((item) => item !== null);
                }
                if (input.spec.source.kustomize && input.spec.source.kustomize.imageTags) {
                    input.spec.source.kustomize.imageTags = input.spec.source.kustomize.imageTags.filter((item) => item !== null);
                }
                props.save(input);
            })}
            values={app} title={app.metadata.name.toLocaleUpperCase()} items={attributes} />
    );
};
