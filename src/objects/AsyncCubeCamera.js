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

	this.backbufferRenderTarget = new THREE.WebGLRenderTargetCube( cubeResolution, cubeResolution, options );
	this.backbufferRenderTarget.texture.name = "BackbufferCubeCamera";
	
	this.renderTarget = new THREE.WebGLRenderTargetCube( cubeResolution, cubeResolution, options );
	this.renderTarget.texture.name = "CubeCamera";

	var backbufferScene = new THREE.Scene();
	
	var boxMesh = new THREE.Mesh(
		new THREE.BoxBufferGeometry( 1, 1, 1 ),
		new THREE.ShaderMaterial( {
			uniforms: THREE.ShaderLib.cube.uniforms,
			vertexShader: THREE.ShaderLib.cube.vertexShader,
			fragmentShader: THREE.ShaderLib.cube.fragmentShader,
			side: THREE.BackSide,
			depthTest: true,
			depthWrite: false,
			fog: false
		} )
	);
	
	boxMesh.material.uniforms.tCube.value = this.backbufferRenderTarget.texture;
	
	backbufferScene.add( boxMesh );
	
	//-
	
	this.backbuffer = true;
	
	this.done = false;

	var stepFace = 0,
		stepX = 0,
		stepY = 0,
		stepBlock = cubeResolution,
		//stepBlock = cubeResolution / 4,
		cameras = [ cameraPX, cameraNX, cameraPY, cameraNY, cameraPZ, cameraNZ ];
	
	this.update = function ( renderer, scene ) {

		if ( this.parent === null ) this.updateMatrixWorld();
		
		var renderTarget = this.backbuffer ? this.backbufferRenderTarget : this.renderTarget;

		renderTarget.activeCubeFace = stepFace;
		renderTarget.scissor.set( stepX, stepY, stepBlock, stepBlock );
		renderTarget.scissorTest = true;
		renderer.render( scene, cameras[stepFace], renderTarget );
		
		//-
		
		this.done = false;
		
		stepX += stepBlock;
		
		if (stepX === cubeResolution) {
			
			stepX = 0;
			stepY += stepBlock;
			
			if (stepY === cubeResolution) {
				
				stepY = 0;
				
				stepFace++;
				
				if (stepFace === 6) {
					
					stepFace = 0;
					
					if (this.backbuffer) {
						
						for(var i = 0; i < 6; i++) {
							
							this.renderTarget.activeCubeFace = i;
							
							renderer.render( backbufferScene, cameras[i], this.renderTarget );
							
						}
					
					}
					
					this.done = true;
					
				}
				
			}
			
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