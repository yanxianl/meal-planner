import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, isBefore, setHours, setMinutes } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from './supabaseClient';
import { Dialog } from '@/components/ui/dialog';
import { useState } from 'react';


const meals = ['早', '中', '晚'];
const mealDeadlines = [6, 9, 14];

const MealPlanner = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [data, setData] = useState([]);
  const [names, setNames] = useState([]);

  const startDay = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const currentStart = format(startDay, 'yyyy-MM-dd');
  const currentEnd = format(addDays(startDay, 6), 'yyyy-MM-dd');

  useEffect(() => {
    fetchData();
  }, [currentWeek]);

  const fetchData = async () => {
    const { data: rows } = await supabase
      .from('meal_plan')
      .select('*')
      .gte('meal_date', currentStart)
      .lte('meal_date', currentEnd);

    const grouped = {};
    rows.forEach(row => {
      const key = row.user_name;
      if (!grouped[key]) grouped[key] = { name: row.user_name, count: 1, plans: {} };
      grouped[key].plans[`${row.meal_date}-${row.meal_type}`] = row.meal_count;
    });

    // 如果是新的一周，继承上周人员
    if (Object.keys(grouped).length === 0 && names.length > 0) {
      const inherited = names.map(u => ({ name: u.name, count: u.count, plans: {} }));
      setNames(inherited);
    } else {
      const inferred = Object.values(grouped).map(u => {
        const mealCounts = Object.values(u.plans);
        const avgCount = mealCounts.length ? Math.round(mealCounts.reduce((a, b) => a + b, 0) / mealCounts.length) : 1;
        return { ...u, count: avgCount };
      });
      setNames(inferred);
    }
    setData(rows);
  };

  const persistUserPlans = async (user) => {
    const records = Object.entries(user.plans).map(([key, count]) => {
      const [meal_date, meal_type] = key.split('-');
      return {
        user_name: user.name,
        meal_date,
        meal_type,
        meal_count: user.count || count || 1,
      };
    });
    if (records.length > 0) {
      await Promise.all(records.map(r => supabase.from('meal_plan').upsert(r)));
    }
  };

  const changeWeek = async (direction) => {
    for (const user of names) {
      if (user.name && Object.keys(user.plans).length > 0) {
        await persistUserPlans(user);
      }
    }
    setCurrentWeek(addDays(currentWeek, direction * 7));
  };

  const handleCheck = async (user, day, meal) => {
    const key = `${day}-${meal}`;
    const existing = user.plans[key];
    if (existing) {
      await supabase.from('meal_plan').delete().match({ user_name: user.name, meal_date: day, meal_type: meal });
    } else {
      await supabase.from('meal_plan').upsert({ user_name: user.name, meal_date: day, meal_type: meal, meal_count: user.count });
    }
    fetchData();
  };

  const getMealCount = (day, meal) => {
    return names.reduce((sum, user) => {
      const key = `${format(day, 'yyyy-MM-dd')}-${meal}`;
      return sum + (user.plans?.[key] ? user.count : 0);
    }, 0);
  };

  const canCheck = (day, mealIdx) => {
    const deadline = setMinutes(setHours(day, mealDeadlines[mealIdx]), 0);
    return isBefore(new Date(), deadline);
  };

  const updateCount = async (idx) => {
    const input = prompt("请输入用餐人数:", names[idx].count);
    const newCount = parseInt(input, 10);
    if (!isNaN(newCount) && newCount > 0) {
      const user = names[idx];
      const updatedPlans = { ...user.plans };
      const updates = Object.keys(updatedPlans).map(key => {
        const [date, type] = key.split('-');
        updatedPlans[key] = newCount;
        return supabase.from('meal_plan').upsert({ user_name: user.name, meal_date: date, meal_type: type, meal_count: newCount });
      });
      await Promise.all(updates);
      const updatedNames = [...names];
      updatedNames[idx] = { ...user, count: newCount, plans: updatedPlans };
      setNames(updatedNames);
    }
  };

  const updateName = async (idx, name) => {
    const oldName = names[idx].name;
    if (name && name !== oldName) {
      const newNames = [...names];
      newNames[idx].name = name;
      setNames(newNames);
      await supabase.from('meal_plan').upsert({ user_name: name, meal_date: currentStart, meal_type: '早', meal_count: 0 });
      fetchData();
    }
  };

  const deleteUser = async (user_name) => {
    if (!window.confirm(`确定删除 ${user_name} 的所有用餐计划吗？`)) return;
    await supabase.from('meal_plan').delete().eq('user_name', user_name);
    fetchData();
  };

  const addUser = () => {
    const name = prompt("请输入员工姓名:");
    if (name) {
      setNames([...names, { name, count: 1, plans: {} }]);
    }
  };

  return (
    <div className="p-6 font-sans max-w-full overflow-x-auto">
      <h2 className="text-3xl font-bold mb-6 text-center">升龙公司德合厂用餐计划表</h2>
      <div className="flex items-center justify-between mb-6">
        <ChevronLeft className="cursor-pointer" onClick={() => changeWeek(-1)} />
        <span className="text-xl font-semibold">
          {format(startDay, 'dd/MM/yyyy')} - {format(addDays(startDay, 6), 'dd/MM/yyyy')}
        </span>
        <ChevronRight className="cursor-pointer" onClick={() => changeWeek(1)} />
      </div>

      <table className="min-w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2" rowSpan={2}>操作</th>
            <th className="border p-2" rowSpan={2}>姓名</th>
            <th className="border p-2" rowSpan={2}>用餐人数</th>
            {[...Array(7)].map((_, idx) => (
              <th key={idx} className="border p-2" colSpan={3}>
                {format(addDays(startDay, idx), 'dd/MM EEE', { locale: zhCN })}
              </th>
            ))}
          </tr>
          <tr>
            {[...Array(7)].map((_, idx) => (
              meals.map(meal => (
                <th key={`${idx}-${meal}`} className="border p-1 bg-gray-50">{meal}</th>
              ))
            ))}
          </tr>
        </thead>
        <tbody>
          {names.map((user, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="border p-2 text-center text-red-500 cursor-pointer" onClick={() => deleteUser(user.name)}>
                <Trash2 size={16} />
              </td>
              <td className="border p-2">
                <input
                  className="w-full"
                  placeholder="输入姓名"
                  value={user.name}
                  onChange={(e) => updateName(idx, e.target.value)}
                />
              </td>
              <td className="border p-2 cursor-pointer" onClick={() => updateCount(idx)}>
                {user.count}
              </td>
              {[...Array(7)].map((_, dayIdx) => (
                meals.map((meal, mealIdx) => {
                  const day = format(addDays(startDay, dayIdx), 'yyyy-MM-dd');
                  const checked = !!user.plans?.[`${day}-${meal}`];
                  return (
                    <td key={`${dayIdx}-${meal}`} className="border p-1 text-center">
                      <input
                        type="checkbox"
                        disabled={!canCheck(addDays(startDay, dayIdx), mealIdx) || !user.name}
                        checked={checked}
                        onChange={() => handleCheck(user, day, meal)}
                      />
                    </td>
                  );
                })
              ))}
            </tr>
          ))}
          <tr className="bg-gray-200 font-bold">
            <td className="border p-2 text-center" colSpan={3}>合计人数</td>
            {[...Array(7)].map((_, dayIdx) => (
              meals.map((meal, mealIdx) => (
                <td key={`total-${dayIdx}-${meal}`} className="border p-1 text-center">
                  {getMealCount(addDays(startDay, dayIdx), meal)}
                </td>
              ))
            ))}
          </tr>
        </tbody>
      </table>
      <button
        className="mt-4 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        onClick={addUser}
      >
        添加员工
      </button>
    </div>
  );
};

const MealPlanner = () => {
  // ...原状态不变
  const [editingUser, setEditingUser] = useState(null);

  // 修改 handleCheck：改为弹窗
  const handleCheck = (user, day, meal) => {
    const key = `${day}-${meal}`;
    const userIndex = names.findIndex(u => u.name === user.name);
    if (userIndex === -1) return;

    // 弹出整行编辑
    setEditingUser({ index: userIndex, ...names[userIndex] });
  };

  const saveEditedUser = async (updatedUser) => {
    const updatedNames = [...names];
    updatedNames[editingUser.index] = updatedUser;
    setNames(updatedNames);
    setEditingUser(null);

    // 保存计划到数据库
    await Promise.all(
      Object.entries(updatedUser.plans).map(([key, count]) => {
        const [date, type] = key.split('-');
        return supabase.from('meal_plan').upsert({
          user_name: updatedUser.name,
          meal_date: date,
          meal_type: type,
          meal_count: updatedUser.count
        });
      })
    );
  };

  // 渲染弹窗
  const renderEditDialog = () => {
    if (!editingUser) return null;

    const onToggle = (date, meal) => {
      const key = `${date}-${meal}`;
      const plans = { ...editingUser.plans };
      if (plans[key]) delete plans[key];
      else plans[key] = editingUser.count;
      setEditingUser({ ...editingUser, plans });
    };

    return (
      <Dialog open={true} onOpenChange={() => setEditingUser(null)}>
        <div className="bg-white p-4 rounded shadow max-w-xl mx-auto mt-10">
          <h3 className="text-lg font-bold mb-2">正在编辑：{editingUser.name}</h3>
          <div className="mb-2">
            用餐人数：
            <input
              type="number"
              min="1"
              value={editingUser.count}
              onChange={e => setEditingUser({ ...editingUser, count: parseInt(e.target.value) || 1 })}
              className="border px-2 py-1 w-20 ml-2"
            />
          </div>
          <div className="grid grid-cols-7 gap-1 text-sm">
            {[...Array(7)].map((_, dayIdx) => (
              <div key={dayIdx}>
                <div className="font-semibold text-center">
                  {format(addDays(startDay, dayIdx), 'MM/dd EEE', { locale: zhCN })}
                </div>
                {meals.map((meal, mealIdx) => {
                  const date = format(addDays(startDay, dayIdx), 'yyyy-MM-dd');
                  const key = `${date}-${meal}`;
                  return (
                    <div key={meal} className="text-center">
                      <label>
                        <input
                          type="checkbox"
                          checked={!!editingUser.plans[key]}
                          onChange={() => onToggle(date, meal)}
                        /> {meal}
                      </label>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setEditingUser(null)} className="px-4 py-1 bg-gray-300 rounded">取消</button>
            <button onClick={() => saveEditedUser(editingUser)} className="px-4 py-1 bg-blue-500 text-white rounded">保存</button>
          </div>
        </div>
      </Dialog>
    );
  };

  return (
    <div className="p-6 font-sans max-w-full overflow-x-auto">
      {/* ...原来的页面内容不变 */}
      {renderEditDialog()}
    </div>
  );
};

export default MealPlanner;
