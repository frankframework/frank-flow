/*
Copyright 2020-2021 WeAreFrank!

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package org.ibissource.frankflow.lifecycle;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.stream.Stream;

import org.apache.catalina.Context;
import org.apache.catalina.connector.Connector;
import org.apache.catalina.startup.Tomcat;
import org.apache.tomcat.util.scan.StandardJarScanner;
import org.ibissource.frankflow.util.FileUtils;
import org.ibissource.frankflow.util.FrankFlowProperties;

public class TomcatInitializer {

	public static void main(String[] args) throws Exception {

		Tomcat tomcat = new Tomcat();

		// The port that we should run on can be set into an environment variable
		// Look for that variable and default to 8080 if it isn't there.
		String webPort = FrankFlowProperties.getProperty("frank-flow.port");
		if(webPort == null || webPort.isEmpty()) {
			webPort = "8080";
		}
		tomcat.setPort(Integer.valueOf(webPort));
		System.out.println("attempting to start tomcat on port [" + webPort + "]");

		File tempDir = getTempDirectory();
		tempDir.mkdirs();

		tomcat.setBaseDir(tempDir.toString());
		File baseDir = tomcat.getHost().getAppBaseFile();
		baseDir.mkdirs();
		System.out.println("resolved base directory to [" + baseDir + "]");

		Connector connector = new Connector();
		connector.setPort(Integer.valueOf(webPort));
		tomcat.setConnector(connector);

		File warFile = expandWarFile(baseDir);
		Context ctx = tomcat.addWebapp("", warFile.toString());
		ctx.setName("Frank!Flow Runner");

		disableJarScanning(ctx);

		// Declare an alternative location for your "WEB-INF/classes" dir
		// Servlet 3.0 annotation will work
//		File additionWebInfClasses = new File("target/classes");
//		WebResourceRoot resources = new StandardRoot(ctx);
//		resources.addPreResources(new DirResourceSet(resources, "/WEB-INF/classes", additionWebInfClasses.getAbsolutePath(), "/"));
//		ctx.setResources(resources);

		tomcat.setAddDefaultWebXmlToWebapp(false);
//		tomcat.getServer().setPort(Integer.valueOf(webPort));

		tomcat.init();
		tomcat.start();
		tomcat.getServer().await();
	}

	private static void disableJarScanning(Context ctx) {
		StandardJarScanner scanner = new StandardJarScanner();
		scanner.setScanManifest(false);
		scanner.setScanBootstrapClassPath(true);
		scanner.setScanClassPath(true);
		scanner.setScanAllFiles(false);
		scanner.setScanAllDirectories(false);
		ctx.setJarScanner(scanner);
	}

	private static File expandWarFile(File baseDir) throws IOException {
		File warFile = new File(baseDir, "ROOT.war");
		System.out.println("expanding war file to ["+warFile+"]");

		File warFolder = new File(baseDir, "ROOT");
		if(warFolder.exists()) {
			try (Stream<Path> stream = Files.walk(warFolder.toPath())) {
				stream.sorted(Comparator.reverseOrder()).map(Path::toFile).forEach(File::delete);
			}
			Files.deleteIfExists(warFolder.toPath());
		}

		Files.deleteIfExists(warFile.toPath());

		URL url = TomcatInitializer.class.getResource("/frank-flow-webapp.war");
		if(url == null) {
			String localWarFile = FrankFlowProperties.getProperty("frank-flow.war");
			if(localWarFile != null) {
				String absPath = FileUtils.getAbsPath(localWarFile);
				url = new File(absPath).toURI().toURL();
			}
		}

		if(url == null) {
			throw new IOException("WAR file not found");
		}

		try (InputStream inputStream = url.openStream(); FileOutputStream fos = new FileOutputStream(warFile)) {
			copy(inputStream, fos);
		}

		if(!warFile.exists()) {
			throw new IOException("expanded WAR not found");
		}

		return warFile;
	}

	private static void copy(InputStream source, OutputStream target) throws IOException {
		byte[] buf = new byte[8192];
		int length;
		while((length = source.read(buf)) > 0) {
			target.write(buf, 0, length);
		}
	}

	private static File getTempDirectory() {
		String directory = System.getProperty("java.io.tmpdir");

		if (directory != null && !directory.isEmpty()) {
			File file = new File(directory);
			if (!file.isAbsolute()) {
				String absPath = new File("").getAbsolutePath();
				if(absPath != null) {
					file = new File(absPath, directory);
				}
			}
			if(!file.exists()) {
				file.mkdirs();
			}
			String fileDir = file.getPath();
			if((fileDir == null || fileDir.isEmpty()) || !file.isDirectory()) {
				throw new IllegalStateException("unknown or invalid path ["+fileDir+"]");
			}
			directory = file.getAbsolutePath();
		}
		System.out.println("resolved temp directory to [" + directory + "]");

		//Directory may be NULL but not empty. The directory has to valid, available and the IBIS must have read+write access to it.
		return (directory == null || directory.isEmpty()) ? null : new File(directory, "frankflow");
	}
}
