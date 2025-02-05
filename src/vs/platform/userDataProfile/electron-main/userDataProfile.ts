/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { URI, UriComponents } from 'vs/base/common/uri';
import { INativeEnvironmentService } from 'vs/platform/environment/common/environment';
import { IFileService } from 'vs/platform/files/common/files';
import { refineServiceDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { IStateMainService } from 'vs/platform/state/electron-main/state';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';
import { IUserDataProfilesService, StoredUserDataProfile, StoredProfileAssociations, WillCreateProfileEvent, WillRemoveProfileEvent, IUserDataProfile } from 'vs/platform/userDataProfile/common/userDataProfile';
import { UserDataProfilesService } from 'vs/platform/userDataProfile/node/userDataProfile';
import { IStringDictionary } from 'vs/base/common/collections';
import { IAnyWorkspaceIdentifier, IEmptyWorkspaceIdentifier } from 'vs/platform/workspace/common/workspace';

export const IUserDataProfilesMainService = refineServiceDecorator<IUserDataProfilesService, IUserDataProfilesMainService>(IUserDataProfilesService);
export interface IUserDataProfilesMainService extends IUserDataProfilesService {
	getProfileForWorkspace(workspaceIdentifier: IAnyWorkspaceIdentifier): IUserDataProfile | undefined;
	unsetWorkspace(workspaceIdentifier: IAnyWorkspaceIdentifier, transient?: boolean): void;
	getAssociatedEmptyWindows(): IEmptyWorkspaceIdentifier[];
	readonly onWillCreateProfile: Event<WillCreateProfileEvent>;
	readonly onWillRemoveProfile: Event<WillRemoveProfileEvent>;
}

export class UserDataProfilesMainService extends UserDataProfilesService implements IUserDataProfilesMainService {

	constructor(
		@IStateMainService private readonly stateMainService: IStateMainService,
		@IUriIdentityService uriIdentityService: IUriIdentityService,
		@INativeEnvironmentService environmentService: INativeEnvironmentService,
		@IFileService fileService: IFileService,
		@ILogService logService: ILogService,
	) {
		super(stateMainService, uriIdentityService, environmentService, fileService, logService);
	}

	getAssociatedEmptyWindows(): IEmptyWorkspaceIdentifier[] {
		const emptyWindows: IEmptyWorkspaceIdentifier[] = [];
		for (const id of this.profilesObject.emptyWindows.keys()) {
			emptyWindows.push({ id });
		}
		return emptyWindows;
	}

	protected override saveStoredProfiles(storedProfiles: StoredUserDataProfile[]): void {
		if (storedProfiles.length) {
			this.stateMainService.setItem(UserDataProfilesMainService.PROFILES_KEY, storedProfiles);
		} else {
			this.stateMainService.removeItem(UserDataProfilesMainService.PROFILES_KEY);
		}
	}

	protected override saveStoredProfileAssociations(storedProfileAssociations: StoredProfileAssociations): void {
		if (storedProfileAssociations.emptyWindows || storedProfileAssociations.workspaces) {
			this.stateMainService.setItem(UserDataProfilesMainService.PROFILE_ASSOCIATIONS_KEY, storedProfileAssociations);
		} else {
			this.stateMainService.removeItem(UserDataProfilesMainService.PROFILE_ASSOCIATIONS_KEY);
		}
	}

	protected override getStoredProfileAssociations(): StoredProfileAssociations {
		const oldKey = 'workspaceAndProfileInfo';
		const storedWorkspaceInfos = this.stateMainService.getItem<{ workspace: UriComponents; profile: UriComponents }[]>(oldKey, undefined);
		if (storedWorkspaceInfos) {
			this.stateMainService.removeItem(oldKey);
			const workspaces = storedWorkspaceInfos.reduce<IStringDictionary<string>>((result, { workspace, profile }) => {
				result[URI.revive(workspace).toString()] = URI.revive(profile).toString();
				return result;
			}, {});
			this.stateMainService.setItem(UserDataProfilesMainService.PROFILE_ASSOCIATIONS_KEY, <StoredProfileAssociations>{ workspaces });
		}
		return super.getStoredProfileAssociations();
	}

}
