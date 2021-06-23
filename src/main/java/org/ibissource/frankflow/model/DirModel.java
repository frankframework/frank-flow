package org.ibissource.frankflow.model;

import java.io.File;
import java.util.ArrayList;

public class DirModel {
    private File dir;
    private ArrayList<DirModel> subDirs;
    private ArrayList<String> files;

    public DirModel(File dir) {
        this.dir = dir;
    }

    public DirModel(File dir, ArrayList<DirModel> subDirs, ArrayList<String> files) {
        this.dir = dir;
        this.subDirs = subDirs;
        this.files = files;
    }

    public File getDir() {
        return dir;
    }

    public void setDir(File dir) {
        this.dir = dir;
    }

    public ArrayList<DirModel> getSubDirs() {
        return subDirs;
    }

    public void setSubDirs(ArrayList<DirModel> subDirs) {
        this.subDirs = subDirs;
    }

    public void addSubDirs(DirModel subDir) {
        this.subDirs.add(subDir);
    }

    public ArrayList<String> getFiles() {
        return files;
    }

    public void setFiles(ArrayList<String> files) {
        this.files = files;
    }

    public void addFiles(String file) {
        this.files.add(file);
    }
}
