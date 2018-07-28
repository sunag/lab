 /**
 * Camera for rendering cube maps
 *	- renders scene into axis-aligned cube
 *
 * @author alteredq / http://alteredqualia.com/
 * @author sunag / http://www.sunag.com.br/
 */

THREE.AsyncCubeCamera = function( near, far, cubeResolution ) {

	THREE.Object3D.call( this );

	this.type = 'CubeCamera';

	var fov = 90, aspect = 1;

	var cameraPX = new THREE.PerspectiveCamera( fov, aspect, near, far );
	cameraPX.up.set( 0, - 1, 0 );
	cameraPX.lookAt( new THREE.Vector3( 1, 0, 0 ) );
	this.add( cameraPX );

	var cameraNX = new THREE.PerspectiveCamera( fov, aspect, near, far );
	cameraNX.up.set( 0, - 1, 0 );
	cameraNX.lookAt( new THREE.Vector3( - 1, 0, 0 ) );
	this.add( cameraNX );

	var cameraPY = new THREE.PerspectiveCamera( fov, aspect, near, far );
	cameraPY.up.set( 0, 0, 1 );
	cameraPY.lookAt( new THREE.Vector3( 0, 1, 0 ) );
	this.add( cameraPY );

	var cameraNY = new THREE.PerspectiveCamera( fov, aspect, near, far );
	cameraNY.up.set( 0, 0, - 1 );
	cameraNY.lookAt( new THREE.Vector3( 0, - 1, 0 ) );
	this.add( cameraNY );

	var cameraPZ = new THREE.PerspectiveCamera( fov, aspect, near, far );
	cameraPZ.up.set( 0, - 1, 0 );
	cameraPZ.lookAt( new THREE.Vector3( 0, 0, 1 ) );
	this.add( cameraPZ );

	var cameraNZ = new THREE.PerspectiveCamera( fov, aspect, near, far );
	cameraNZ.up.set( 0, - 1, 0 );
	cameraNZ.lookAt( new THREE.Vector3( 0, 0, - 1 ) );
	this.add( cameraNZ );

	var options = { format: THREE.RGBFormat, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter };

	this.backbufferRenderTargets = [
		new THREE.WebGLRenderTargetCube( cubeResolution, cubeResolution, options ),
		new THREE.WebGLRenderTargetCube( cubeResolution, cubeResolution, options ),
		new THREE.WebGLRenderTargetCube( cubeResolution, cubeResolution, options )
	];
	
	this.renderTarget = new THREE.WebGLRenderTargetCube( cubeResolution, cubeResolution, options );
	this.renderTarget.texture.name = "CubeCamera";

	var backbufferScene = new THREE.Scene();
	
	var boxMesh = new THREE.Mesh(
		new THREE.BoxBufferGeometry( 1, 1, 1 ),
		new THREE.ShaderMaterial( {
			uniforms: {
				'tCubeA': { value: null },
				'tCubeB': { value: null },
				'alpha': { value: 1 }
			},
			vertexShader: THREE.ShaderLib.cube.vertexShader,
			fragmentShader: [
				"uniform samplerCube tCubeA;",
				"uniform samplerCube tCubeB;",
				"uniform float alpha;",
				
				"varying vec3 vWorldPosition;",
				
				"#include <common>",
				
				"void main() {",
				
					"vec4 cubeA = textureCube( tCubeA, vWorldPosition.xyz );",
					"vec4 cubeB = textureCube( tCubeB, vWorldPosition.xyz );",
					
					"gl_FragColor = mix( cubeA, cubeB, alpha );",
					
				"}",
			].join( '\n' ),
			side: THREE.BackSide,
			depthTest: true,
			depthWrite: false,
			fog: false
		} )
	);
	
	backbufferScene.add( boxMesh );
	
	//-
	
	this.done = false;
	this.progress = 0;

	var stepFace = 0,
		stepX = 0,
		stepY = 0,
		stepTotal = 0,
		stepMax = cubeResolution * 6,
		stepDivision = 2,
		cubeIndex = 0,
		cubeMax = this.backbufferRenderTargets.length,
		//stepBlock = cubeResolution,
		stepBlock = cubeResolution / stepDivision,
		cameras = [ cameraPX, cameraNX, cameraPY, cameraNY, cameraPZ, cameraNZ ];
	
	this.update = function ( renderer, scene ) {

		if ( this.parent === null ) this.updateMatrixWorld();
		
		var renderTarget = this.backbufferRenderTargets[ cubeIndex ];

		renderTarget.activeCubeFace = stepFace;
		renderTarget.scissor.set( stepX, stepY, stepBlock, stepBlock );
		renderTarget.scissorTest = true;
		renderer.render( scene, cameras[stepFace], renderTarget );
		
		//-
		
		this.done = false;
		
		stepX += stepBlock;
		stepTotal += stepBlock;
		
		if (stepX === cubeResolution) {
			
			stepX = 0;
			stepY += stepBlock;
			
			if (stepY === cubeResolution) {
				
				stepY = 0;
				
				stepFace++;
				
				if (stepFace === 6) {
					
					stepFace = 0;
					stepTotal = 0;
					
					cubeIndex = ( cubeIndex + 1 ) % cubeMax;
					
					this.done = true;
					
				}
				
			}
			
		}

		this.progress = ( stepTotal / stepDivision ) / stepMax;

		boxMesh.material.uniforms.tCubeA.value = this.backbufferRenderTargets[ ( cubeIndex + 1 ) % cubeMax ].texture;
		boxMesh.material.uniforms.tCubeB.value = this.backbufferRenderTargets[ ( cubeIndex + 2 ) % cubeMax ].texture;
		boxMesh.material.uniforms.alpha.value = this.progress;
		
		for(var i = 0; i < 6; i++) {
							
			this.renderTarget.activeCubeFace = i;
			
			renderer.render( backbufferScene, cameras[i], this.renderTarget );
			
		}
		
		
		
		//-

		renderer.setRenderTarget( null );

	};

	this.clear = function ( renderer, color, depth, stencil ) {

		var renderTarget = this.renderTarget;

		for ( var i = 0; i < 6; i ++ ) {

			renderTarget.activeCubeFace = i;
			renderer.setRenderTarget( renderTarget );

			renderer.clear( color, depth, stencil );

		}

		renderer.setRenderTarget( null );

	};

}

THREE.AsyncCubeCamera.prototype = Object.create( THREE.Object3D.prototype );
THREE.AsyncCubeCamera.prototype.constructor = THREE.AsyncCubeCamera;
