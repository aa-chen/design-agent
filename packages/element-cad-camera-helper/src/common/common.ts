import * as THREE from 'three';
import { Box2 } from "@do-math/core";

class CadCameraHelperCommonImp {
    public createXYClippingPlanes(box: Box2): THREE.Plane[] {
        const { min, max } = box;
        const clippingPlanes = [
            // new THREE.Plane(new THREE.Vector3(-1, 0, 0), max.x + 1e-2),
            // new THREE.Plane(new THREE.Vector3(1, 0, 0), -min.x + 1e-2),
            // new THREE.Plane(new THREE.Vector3(0, -1, 0), max.y + 1e-2),
            // new THREE.Plane(new THREE.Vector3(0, 1, 0), -min.y + 1e-2),
            new THREE.Plane(new THREE.Vector3(-1, 0, 0), max.x + 1e-2),
            new THREE.Plane(new THREE.Vector3(1, 0, 0), -min.x + 1e-2),
            new THREE.Plane(new THREE.Vector3(0, -1, 0), max.y + 1e-2),
            new THREE.Plane(new THREE.Vector3(0, 1, 0), -min.y + 1e-2),
        ];
        return clippingPlanes;
    }
}

export const CadCameraHelperCommon = new CadCameraHelperCommonImp();