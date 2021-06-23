package org.ibissource.frankflow.service;

import org.ibissource.frankflow.dao.DirDao;
import org.ibissource.frankflow.model.DirModel;

public class DirService {

    public DirModel getDirs(String path) {
        DirDao dir = new DirDao();

        return dir.get(path);
    }

    public DirModel getDirs() {
        return getDirs(".");
    }


}
