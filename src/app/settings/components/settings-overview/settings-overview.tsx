import * as PropTypes from 'prop-types';
import * as React from 'react';

import { Page } from '../../../shared/components';
import { AppContext } from '../../../shared/context';

require('./settings-overview.scss');

const settings = [{
    title: 'Repositories', description: 'Configure connected Git repositories', path: './repos',
}, {
    title: 'Clusters', description: 'Configure connected Kubernetes clusters', path: './clusters',
}, {
    title: 'Projects', description: 'Configure Argo CD projects', path: './projects',
}];

export const SettingsOverview: React.StatelessComponent = (props: any, context: AppContext) => (
    <Page title='Settings' toolbar={{ breadcrumbs: [{title: 'Settings'}] }}>
        <div className='settings-overview'>
            <div className='argo-container'>
                {settings.map((item) => (
                    <div key={item.path} className='settings-overview__redirect-panel' onClick={() => context.apis.navigation.goto(item.path)}>
                        <div className='settings-overview__redirect-panel__ico'><i className='argo-icon-checked'/></div>
                        <div className='settings-overview__redirect-panel__content'>
                            <div className='settings-overview__redirect-panel__title'>{item.title}</div>
                            <div className='settings-overview__redirect-panel__description'>{item.description}</div>
                        </div>
                        <div className='settings-overview__redirect-panel__arrow'><i className='fa fa-angle-right'/></div>
                    </div>
                ))}
            </div>
        </div>
    </Page>
);

SettingsOverview.contextTypes = {
    apis: PropTypes.object,
};
