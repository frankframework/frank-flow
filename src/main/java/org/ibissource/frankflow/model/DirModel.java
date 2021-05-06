package org.ibissource.frankflow.model;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class DirModel {
    private final File dir;
    private final List<String> files;
    private final List<DirModel> subDirs;

    public DirModel(String path) {
        this.dir = new File(path);
        this.files = new ArrayList<>();
        this.subDirs = new ArrayList<>();

        this.getContent();
    }

    public String getPath() {
        return this.dir.getPath();
    }

    public String getName() {
        return this.dir.getName();
    }

    public List<String> getFiles() {
        return this.files;
    }

    public List<DirModel> getSubDirs() {
        return subDirs;
    }

    private void getContent() {
        File[] contents = this.dir.listFiles();

        if (contents != null) {
            for (File content : contents) {
                if (content.isDirectory()) {
                    this.subDirs.add(new DirModel(content.getPath()));
                } else if (content.isFile()) {
                    this.files.add(content.getName());
                }
            }
        }
    }
}
