package org.ibissource.frankflow.model;

import org.apache.commons.io.IOUtils;

import java.io.*;
import java.nio.charset.StandardCharsets;

public class FileModel {
    private final File file;

    public FileModel(String path) {
        this.file = new File(path);
    }

    public String getPath() {
        return this.file.getPath();
    }

    public String getName() {
        return this.file.getName();
    }

    public String getContent() throws IOException {
        FileInputStream fileInputStream = new FileInputStream(this.file);
        return IOUtils.toString(fileInputStream, StandardCharsets.UTF_8);
    }

    public boolean renameTo(String name) {
        return this.file.renameTo(new File(name));
    }
}
