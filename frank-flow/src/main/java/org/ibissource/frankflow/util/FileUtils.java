/*
Copyright 2020 WeAreFrank!

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

	public static String getAbsPath(String path) {

		if(StringUtils.isEmpty(path)) {
			return null;
		}

		String absPath = getDir((File)null, path).toURI().toString();
		log.info("found local frontend path ["+absPath+"]");

		return absPath;
	}

	public static boolean createDir(File file) {
		if(!file.exists()) {
			return file.mkdirs();
		}
		return false;
	}
}
