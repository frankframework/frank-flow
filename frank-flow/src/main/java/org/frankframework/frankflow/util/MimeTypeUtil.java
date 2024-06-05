/*
   Copyright 2022-2024 WeAreFrank!

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

import java.io.IOException;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.http.MediaType;

public abstract class MimeTypeUtil {

	private static Map<String, MediaType> mediaTypeMap;
	private static final Logger log = LogManager.getLogger(MimeTypeUtil.class);

	private static synchronized Map<String, MediaType> getMimeTypeMap() throws IOException {
		if(mediaTypeMap == null) {
			mediaTypeMap = new HashMap<>();
			Properties properties = new Properties();
			URL mappingFile = MimeTypeUtil.class.getResource("/mediaType.mapping");
			if(mappingFile == null) {
				throw new IOException("unable to open mediaType mapping file");
			}
	
			properties.load(mappingFile.openStream());
			for(String key : properties.stringPropertyNames()) {
				String value = properties.getProperty(key);
				mediaTypeMap.put(key, MediaType.valueOf(value));
			}
		}

		return mediaTypeMap;
	}

	public static MediaType determineFromPathMimeType(String path) throws IOException {
		int i = path.lastIndexOf(".");
		String extension = path.substring(i+1); //Get the extension
		int p = extension.indexOf("?");
		if(p > -1) {
			extension = extension.substring(0, p); //Remove all parameters
		}

		log.debug("determined extension [{}] from path [{}]", extension, path);
		return findMediaType(extension);
	}

	public static MediaType findMediaType(String extension) throws IOException {
		log.debug("trying to find MimeType for extension [{}]", extension);

		MediaType type = getMimeTypeMap().get(extension);
		if(type == null) {
			log.warn("unable to find MimeType for extension [{}] using default [application/octet-stream]", extension);
			type = MediaType.APPLICATION_OCTET_STREAM;
		} else {
			log.debug("determined MimeType [{}] for extension [{}]", type, extension);
		}
		return type;
	}

}
