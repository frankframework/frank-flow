package org.ibissource.frankflow.util;

import java.io.File;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.util.StringUtils;

public abstract class FileUtils {

	private static final Logger log = LogManager.getLogger(FileUtils.class);
	public static final String BASE_DIR = System.getProperty("configurations.directory");

	static {
		log.info("using configuration.directory ["+BASE_DIR+"]");
	}

	public static File getBaseDir() {
		return getDir((File)null, BASE_DIR);
	}

	/**
	 * Get sub-directory relative to baseDir
	 */
	public static File getDir(String directory) {
		return getDir(getBaseDir(), directory);
	}

	/**
	 * Get sub-directory relative to baseDir
	 */
	public static File getDir(String baseDir, String directory) {
		return getDir(getDir(baseDir), directory);
	}

	/**
	 * Get sub-directory relative to baseDir
	 */
	private static File getDir(File baseDir, String directory) {
		File dir = new File(baseDir, directory);
		if(!dir.exists()) {
			throw new IllegalStateException("path ["+directory+"] doesn't not exist");
		}
		if(!dir.isDirectory()) {
			throw new IllegalStateException("path ["+directory+"] is not a directory");
		}
		return dir;
	}

	public static String getFrontendPath() {
		String path = System.getProperty("frank-flow.frontend.path"); //change this in catalina.properties

		if(StringUtils.isEmpty(path)) {
			return null;
		}

		String absPath = getDir((File)null, path).toURI().toString();
		log.info("found local frontend path ["+absPath+"]");

		return absPath;
	}
}
