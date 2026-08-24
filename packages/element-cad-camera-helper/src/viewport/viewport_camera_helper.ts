import { AbstractCameraHelper, EN_EVENT_TYPE, eventManager, registerElementCameraHelper } from '@do-design/d-model';
import { ICamera, ICameraStatus, IOrthogonalProperties, IPerspectiveProperties, matrixX2T } from '@do-design/d-render';
import { CadViewportElement, GraphicCadElement } from '@do-design/element-cad-core';
import { Matrix4 } from '@do-math/core';
import { EN_RENDER_AREA, EN_RENDER_SPACE } from '@do-types/core-types';
import { CadCameraHelperCommon } from '../common/common';

@registerElementCameraHelper(CadViewportElement)
export class ViewportCameraHelper extends AbstractCameraHelper<CadViewportElement> {
    private _camera: ICamera;

    private _cameraListener: (data: { camera: ICamera, status: ICameraStatus }) => void;

    public createCamera(): ICamera {
        const cameraManager = this._sysWindow.getRenderView().getCameraManager();
        const paperCamera = cameraManager.getAllCameras().find((c) => c.name === EN_RENDER_SPACE.PAPER_SPACE);
        if (!paperCamera) {
            throw new Error('create viewport camera require paper camera');
        }
        const cameraName = this._master.getCameraName();
        this._camera = cameraManager.createSupportCamera(cameraName);
        this._camera.space = EN_RENDER_SPACE.PAPER_SPACE;
        this._camera.renderScenes = [EN_RENDER_AREA.MODEL];
        const targetArea = this._master.getTargetArea();
        this._camera.transform(matrixX2T(this._master.getModel2PaperMatrix()!.inverse()!));
        this._camera.clippingPlanes = CadCameraHelperCommon.createXYClippingPlanes(targetArea);
        this._cameraListener = (data: { camera: ICamera, status: ICameraStatus }) => {
            const { camera: syncCamera } = data;
            if (syncCamera.name === EN_RENDER_SPACE.PAPER_SPACE) {
                this._camera.copy(syncCamera);
                const matrix = matrixX2T(this._master.getModel2PaperMatrix()!.inverse()!);
                this._camera.transform(matrix);
            }
        };
        this._updateCameraModelClipBox();
        
        eventManager.addEventListener(EN_EVENT_TYPE.CAMERA_SYNC, this._cameraListener);
        return this._camera;
    }
    
    public activeCamera(camera: ICamera): void {
        camera.renderScenes.push(EN_RENDER_AREA.ACTIVE, EN_RENDER_AREA.OVERLAY, EN_RENDER_AREA.SELECTION);
        const cameraManager = this._sysWindow.getRenderView().getCameraManager();
        cameraManager.setCurrentCamera(camera.name);
        // disable others
        this._disableOtherCameras(camera);
    }

    public recover(camera: ICamera<IOrthogonalProperties | IPerspectiveProperties>): void {
        camera.renderScenes = camera.renderScenes.filter((s) => ![EN_RENDER_AREA.ACTIVE, EN_RENDER_AREA.OVERLAY, EN_RENDER_AREA.SELECTION].includes(s));
        this._enableAllCameras();
        this._sysWindow.getRenderView().resetCurrentCamera(EN_RENDER_SPACE.PAPER_SPACE);
    }

    public updateCamera(camera: ICamera): void {
        camera.clippingPlanes = CadCameraHelperCommon.createXYClippingPlanes(this._master.getTargetArea());
        this._updateCameraModelClipBox();
    }

    public destroyCamera(): void {
        eventManager.removeEventListener(EN_EVENT_TYPE.CAMERA_SYNC, this._cameraListener);
    }

    public getFollowMatrix(): Matrix4 {
        return this._master.getModel2PaperMatrix()!.inverse()!;
    }

    private _disableOtherCameras(currentCamera: ICamera) {
        const cameraManager = this._sysWindow.getRenderView().getCameraManager();
        const allCameras = cameraManager.getAllCameras();
        for (const camera of allCameras) {
            if (camera === currentCamera) {
                camera.enable();
            } else {
                camera.disable();
            }
        }
    }

    private _enableAllCameras() {
        const cameraManager = this._sysWindow.getRenderView().getCameraManager();
        const allCameras = cameraManager.getAllCameras();
        allCameras.forEach((c) => c.enable());
    }

    private _updateCameraModelClipBox() {
        this._camera.modelClipBox2 = this._master.getTargetArea();
    }
}