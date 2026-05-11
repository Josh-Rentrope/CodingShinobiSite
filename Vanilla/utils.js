import * as THREE from 'three';

export function getTexture(data) {
    const canvas = document.createElement('canvas');
    canvas.width = 600; canvas.height = 300;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);

    function drawLayer(imgElement) {
        if (imgElement) {
            ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff'; ctx.font = '300 32px "Segoe UI"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(data.title.toUpperCase(), canvas.width / 2, canvas.height / 2);
        texture.needsUpdate = true; 
    }

    if (data.images && data.images.length > 0) {
        const img = new Image(); img.crossOrigin = "Anonymous";
        img.onload = () => drawLayer(img); img.src = data.images[0];
    } else { drawLayer(null); }

    return texture;
}

export function createHelix(points, heightStep, projectSpacing, projectData, radius, hexColor, isMain = false) {
    const group = new THREE.Group();
    const glowColor = new THREE.Color(hexColor).multiplyScalar(2.5);
    const nodes = [];
    const rungs = [];

    for (let i = -20; i < points; i++) {
        const angle = i * 0.4;
        const y = -(i * heightStep);
        
        const dotMat = new THREE.MeshBasicMaterial({ 
            color: glowColor, 
            transparent: true, 
            opacity: 0, 
            blending: THREE.AdditiveBlending 
        });
        
        const dotA = new THREE.Mesh(new THREE.SphereGeometry(isMain ? 0.12 : 0.06, 12, 12), dotMat);
        dotA.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        group.add(dotA);
        nodes.push(dotA);

        const dotB = dotA.clone();
        dotB.position.set(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius);
        group.add(dotB);
        nodes.push(dotB);

        // --- THE MISSING RUNGS ---
        const rungGeo = new THREE.CylinderGeometry(0.01, 0.01, radius * 2);
        rungGeo.rotateZ(Math.PI / 2);
        const rungMat = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
        const rung = new THREE.Mesh(rungGeo, rungMat);
        rung.position.set(0, y, 0);
        rung.rotation.y = -angle;
        group.add(rung);
        rungs.push(rung);

        if (isMain && i > 0 && i % projectSpacing === 0) {
            const dataIndex = (i / projectSpacing) - 1;
            if (dataIndex < projectData.length) {
                const plane = new THREE.Mesh(
                    new THREE.PlaneGeometry(4, 2), 
                    new THREE.MeshBasicMaterial({ 
                        map: getTexture(projectData[dataIndex]), 
                        side: THREE.DoubleSide, 
                        transparent: true, 
                        opacity: 0 
                    })
                );
                const planeX = Math.cos(angle) * (radius + 4.5);
                const planeZ = Math.sin(angle) * (radius + 4.5);
                plane.position.set(planeX, y, planeZ);
                plane.lookAt(planeX * 2, y, planeZ * 2);
                plane.userData = projectData[dataIndex];
                group.add(plane);
                nodes.push(plane); 
            }
        }
    }
    return { group, nodes, rungs };
}