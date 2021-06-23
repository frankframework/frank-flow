package org.ibissource.frankflow.dao;

import org.ibissource.frankflow.model.DirModel;

import java.io.File;
import java.util.List;

public class DirDao {

    public DirModel get(String path) {
        DirModel dir = new DirModel(new File(path));
        File[] contents = dir.getDir().listFiles();

        if (contents != null) {
            for (File content : contents) {
                if (content.isDirectory()) {
                    dir.addSubDirs(this.get(content.getPath()));
                } else if (content.isFile()) {
                    dir.addFiles(content.getName());
                }
            }
        }

        return dir;
    }

    public void create(DirModel dirModel) {

    }

    public void update(DirModel dirModel, String[] params) {

    }

    public void delete(DirModel dirModel) {

    }
}
