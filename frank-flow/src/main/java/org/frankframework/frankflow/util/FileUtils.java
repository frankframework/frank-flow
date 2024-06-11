/*
   Copyright 2020 - 2024 WeAreFrank!

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
package org.frankframework.frankflow.util;

import java.io.File;

import org.frankframework.frankflow.dto.ConfigurationDTO;

public abstract class FileUtils {

	public static File getConfigurationRoot(ConfigurationDTO config) {
		return getDir(config.getDirectory());
	}

	/**
	 * Get sub-directory relative to baseDir
	 */
	private static File getDir(String directory) {
		File dir = new File(directory);
		if(!dir.exists()) {
			throw new IllegalStateException("path ["+directory+"] doesn't not exist");
		}
		if(!dir.isDirectory()) {
			throw new IllegalStateException("path ["+directory+"] is not a directory");
		}
		return dir;
	}

	public static boolean createDir(File file) {
		if(!file.exists()) {
			return file.mkdirs();
		}
		return false;
	}
}
